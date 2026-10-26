import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import zlib from "node:zlib";

export const PREVIEW_TIMEOUT_MS = 8000;
export const PREVIEW_MAX_BYTES = 1024 * 1024;
export const PREVIEW_MAX_REDIRECTS = 4;
export const MAX_URL_LENGTH = 2048;

export type LinkPreview = {
  url: string;
  domain: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  priceText?: string;
  priceAmount?: number;
};

export class PreviewError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// URL validation and SSRF guard
// ---------------------------------------------------------------------------

function ipv4ToNumber(ip: string): number {
  return ip
    .split(".")
    .reduce((total, part) => total * 256 + Number(part), 0);
}

const privateV4Ranges: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function isPrivateIPv4(ip: string): boolean {
  const value = ipv4ToNumber(ip);
  return privateV4Ranges.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    const start = ipv4ToNumber(base);
    return value >= start && value < start + size;
  });
}

/** Expand an IPv6 address (no zone id) into eight 16-bit groups. */
function ipv6Groups(ip: string): number[] | null {
  let address = ip.toLowerCase();
  // Embedded dotted IPv4 tail (e.g. ::ffff:127.0.0.1).
  const v4 = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    if (isIP(v4[1]) !== 4) return null;
    const n = ipv4ToNumber(v4[1]);
    address = address.slice(0, -v4[1].length) +
      `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 0) return null;
  const groups = [...head, ...Array(missing).fill("0"), ...tail].map((part) =>
    parseInt(part, 16),
  );
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff)
    ? groups
    : null;
}

function isPrivateIPv6(ip: string): boolean {
  const groups = ipv6Groups(ip.split("%")[0]);
  if (!groups) return true; // unparseable: treat as unsafe
  const embeddedV4 = () =>
    `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
  const zeroPrefix = (count: number) =>
    groups.slice(0, count).every((g) => g === 0);
  if (groups.every((g) => g === 0)) return true; // ::
  if (zeroPrefix(7) && groups[7] === 1) return true; // ::1
  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d
  if (zeroPrefix(5) && groups[5] === 0xffff) return isPrivateIPv4(embeddedV4());
  if (zeroPrefix(6)) return isPrivateIPv4(embeddedV4());
  // NAT64 64:ff9b::/96
  if (groups[0] === 0x64 && groups[1] === 0xff9b &&
      groups.slice(2, 6).every((g) => g === 0))
    return isPrivateIPv4(embeddedV4());
  const first = groups[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 site local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (first === 0x2001 && groups[1] === 0x0db8) return true; // documentation
  if (first === 0x0100 && groups.slice(1, 4).every((g) => g === 0)) return true; // discard
  if (first === 0x2002) {
    // 6to4 embeds an IPv4 address in groups 1-2.
    const v4 = `${groups[1] >> 8}.${groups[1] & 255}.${groups[2] >> 8}.${groups[2] & 255}`;
    return isPrivateIPv4(v4);
  }
  return false;
}

/** True for loopback, private, link-local, reserved and other non-public IPs. */
export function isPrivateAddress(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, "");
  const family = isIP(clean.split("%")[0]);
  if (family === 4) return isPrivateIPv4(clean);
  if (family === 6) return isPrivateIPv6(clean);
  return true;
}

const blockedHostSuffixes = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home.arpa",
];

/**
 * Parse and validate a user-supplied URL. Only http/https on default ports,
 * no credentials, no localhost-like names and no literal private IPs.
 * DNS results are checked separately at connection time.
 */
export function validatePreviewUrl(raw: unknown): URL {
  if (typeof raw !== "string") throw new PreviewError("קישור לא תקין", 400);
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH)
    throw new PreviewError("קישור לא תקין", 400);
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new PreviewError("קישור לא תקין", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new PreviewError("אפשר להוסיף רק קישורי http או https", 400);
  if (url.username || url.password)
    throw new PreviewError("קישור לא תקין", 400);
  if (url.port && !["80", "443"].includes(url.port))
    throw new PreviewError("הקישור הזה לא נתמך", 400);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !host ||
    host === "localhost" ||
    blockedHostSuffixes.some((suffix) => host.endsWith(suffix))
  )
    throw new PreviewError("הקישור הזה לא נתמך", 400);
  const literal = host.replace(/^\[|\]$/g, "");
  if (isIP(literal)) {
    if (isPrivateAddress(literal))
      throw new PreviewError("הקישור הזה לא נתמך", 400);
  } else if (!host.includes(".")) {
    // Single-label names only resolve on internal networks.
    throw new PreviewError("הקישור הזה לא נתמך", 400);
  }
  url.hash = "";
  return url;
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * DNS lookup used by the HTTP agent itself, so the address that is checked is
 * exactly the address that is connected to (no DNS-rebinding window).
 */
export function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number } | number | undefined,
  callback: LookupCallback,
) {
  const all = typeof options === "object" && !!options?.all;
  dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error, all ? [] : "");
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
      const blocked = new Error("Blocked address") as NodeJS.ErrnoException;
      blocked.code = "EBLOCKED";
      return callback(blocked, all ? [] : "");
    }
    if (all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  shy: "",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  middot: "·",
  bull: "•",
  euro: "€",
  shekel: "₪",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      try {
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      } catch {
        return match;
      }
    }
    return namedEntities[entity.toLowerCase()] ?? match;
  });
}

function clean(text: string | undefined, max: number): string | undefined {
  if (!text) return undefined;
  const value = decodeEntities(text)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=/<>"']+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match: RegExpExecArray | null;
  // Skip the tag name itself.
  const body = tag.replace(/^<\s*[a-z]+/i, "");
  while ((match = pattern.exec(body))) {
    const name = match[1].toLowerCase();
    if (!(name in attributes))
      attributes[name] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function absoluteHttpUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(decodeEntities(value.trim()), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    const text = url.toString();
    return text.length <= MAX_URL_LENGTH ? text : undefined;
  } catch {
    return undefined;
  }
}

const NUMBER = String.raw`(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?`;
const CURRENCY = String.raw`(?:₪|ש["״']?ח|ILS|NIS|\$|USD|€|EUR)`;
const currencyPrice = new RegExp(
  `${CURRENCY}\\s?${NUMBER}|${NUMBER}\\s?${CURRENCY}`,
  "i",
);

/** Find a price-looking snippet such as "₪1,250" or "850 ש"ח" in free text. */
export function extractPriceText(text: string): string | undefined {
  const match = decodeEntities(text).match(currencyPrice);
  return match ? match[0].replace(/\s+/g, " ").trim() : undefined;
}

export function priceAmountFrom(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const digits = text.match(new RegExp(NUMBER));
  if (!digits) return undefined;
  const value = Number(digits[0].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 && value < 1_000_000 ? value : undefined;
}

/** Extract Open Graph / Twitter / basic HTML metadata plus a price hint. */
export function parseOpenGraph(html: string, pageUrl: string): LinkPreview {
  const url = new URL(pageUrl);
  const head = html.slice(0, PREVIEW_MAX_BYTES);
  const meta: Record<string, string> = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.property || attributes.name || attributes.itemprop || "")
      .toLowerCase()
      .trim();
    const content = attributes.content;
    if (key && content !== undefined && !(key in meta)) meta[key] = content;
  }
  let imageLink: string | undefined;
  for (const tag of head.match(/<link\b[^>]*>/gi) || []) {
    const attributes = parseAttributes(tag);
    if ((attributes.rel || "").toLowerCase() === "image_src") {
      imageLink = attributes.href;
      break;
    }
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const structuredAmount =
    meta["product:price:amount"] ||
    meta["og:price:amount"] ||
    meta["price"] ||
    head.match(/"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/)?.[1] ||
    head.match(/"lowPrice"\s*:\s*"?(\d+(?:\.\d+)?)"?/)?.[1];
  const currency =
    meta["product:price:currency"] || meta["og:price:currency"] || meta["pricecurrency"];
  const description = clean(
    meta["og:description"] || meta["twitter:description"] || meta["description"],
    500,
  );
  const title = clean(meta["og:title"] || meta["twitter:title"] || titleTag, 200);
  const symbol = currency
    ? ({ ILS: "₪", NIS: "₪", USD: "$", EUR: "€" } as Record<string, string>)[
        currency.toUpperCase()
      ] || `${currency.toUpperCase()} `
    : "";
  let priceText: string | undefined;
  let priceAmount: number | undefined;
  const amount = priceAmountFrom(structuredAmount);
  if (amount !== undefined) {
    priceAmount = amount;
    priceText = clean(`${symbol || "₪"}${amount.toLocaleString("en-US")}`, 60);
  } else {
    const bodyText = head
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    priceText = extractPriceText(
      [title, description, meta["twitter:data1"], bodyText].filter(Boolean).join(" \n "),
    );
    priceAmount = priceAmountFrom(priceText);
  }

  return {
    url: url.toString(),
    domain: url.hostname.replace(/^www\./, ""),
    title,
    description,
    image: absoluteHttpUrl(
      meta["og:image:secure_url"] ||
        meta["og:image"] ||
        meta["og:image:url"] ||
        meta["twitter:image"] ||
        meta["twitter:image:src"] ||
        imageLink,
      url.toString(),
    ),
    siteName: clean(meta["og:site_name"] || meta["application-name"], 100),
    priceText,
    priceAmount,
  };
}

/** Target of a <meta http-equiv="refresh" content="0;url=..."> tag, if any. */
export function metaRefreshUrl(html: string, base: string): string | undefined {
  for (const tag of html.slice(0, 65536).match(/<meta\b[^>]*>/gi) || []) {
    const attributes = parseAttributes(tag);
    if ((attributes["http-equiv"] || "").toLowerCase() !== "refresh") continue;
    const target = attributes.content?.match(/url\s*=\s*['"]?([^'"]+)/i)?.[1];
    return absoluteHttpUrl(target, base);
  }
  return undefined;
}

function charsetFrom(contentType: string, sniff: Buffer): string {
  const fromHeader = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const ascii = sniff.subarray(0, 4096).toString("latin1");
  return (
    ascii.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]?.toLowerCase() || "utf-8"
  );
}

export function decodeBody(body: Buffer, contentType: string): string {
  try {
    return new TextDecoder(charsetFrom(contentType, body)).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

type RawResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

function requestOnce(url: URL, signal: AbortSignal): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup as unknown as typeof dnsLookup,
        signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; YoloLinkPreview/1.0; +https://yoloooo.vercel.app)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400) {
          response.resume();
          return resolve({ status, headers: response.headers, body: Buffer.alloc(0) });
        }
        const declared = Number(response.headers["content-length"] || 0);
        if (declared > PREVIEW_MAX_BYTES * 8) {
          response.destroy();
          return reject(new PreviewError("הדף גדול מדי"));
        }
        const encoding = String(response.headers["content-encoding"] || "").toLowerCase();
        const stream =
          encoding === "gzip" || encoding === "x-gzip"
            ? response.pipe(zlib.createGunzip())
            : encoding === "deflate"
              ? response.pipe(zlib.createInflate())
              : encoding === "br"
                ? response.pipe(zlib.createBrotliDecompress())
                : response;
        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve({ status, headers: response.headers, body: Buffer.concat(chunks) });
          response.destroy();
        };
        stream.on("data", (chunk: Buffer) => {
          if (done) return;
          const room = PREVIEW_MAX_BYTES - size;
          chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
          size += Math.min(chunk.length, room);
          // Metadata lives in <head>; stop at the size limit.
          if (size >= PREVIEW_MAX_BYTES) finish();
        });
        stream.on("end", finish);
        stream.on("error", (error) => {
          if (done) return;
          if (chunks.length) finish();
          else reject(error);
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

/** Fetch a public page and return its preview metadata. */
export async function fetchLinkPreview(
  rawUrl: unknown,
  timeoutMs = PREVIEW_TIMEOUT_MS,
): Promise<LinkPreview> {
  let url = validatePreviewUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let redirects = 0; ; redirects++) {
      let response: RawResponse;
      try {
        response = await requestOnce(url, controller.signal);
      } catch (error) {
        if (error instanceof PreviewError) throw error;
        if (controller.signal.aborted)
          throw new PreviewError("האתר לא הגיב בזמן", 504);
        if ((error as NodeJS.ErrnoException)?.code === "EBLOCKED")
          throw new PreviewError("הקישור הזה לא נתמך", 400);
        throw new PreviewError("לא הצלחנו לפתוח את הקישור", 502);
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location;
        if (!location || redirects >= PREVIEW_MAX_REDIRECTS)
          throw new PreviewError("יותר מדי הפניות", 502);
        url = validatePreviewUrl(new URL(location, url).toString());
        continue;
      }
      if (response.status >= 400)
        throw new PreviewError("האתר סירב להציג את הדף", 502);
      const contentType = String(response.headers["content-type"] || "").toLowerCase();
      if (contentType.startsWith("image/"))
        return {
          url: url.toString(),
          domain: url.hostname.replace(/^www\./, ""),
          image: url.toString(),
        };
      if (contentType && !/html|xml/.test(contentType))
        throw new PreviewError("הקישור לא מוביל לדף אינטרנט", 422);
      const html = decodeBody(response.body, contentType);
      // Some sites (e.g. Airbnb locale redirects) bounce through <meta http-equiv="refresh">.
      const refresh = /og:title/i.test(html) ? undefined : metaRefreshUrl(html, url.toString());
      if (refresh && redirects < PREVIEW_MAX_REDIRECTS && refresh !== url.toString()) {
        url = validatePreviewUrl(refresh);
        continue;
      }
      return parseOpenGraph(html, url.toString());
    }
  } finally {
    clearTimeout(timer);
  }
}
