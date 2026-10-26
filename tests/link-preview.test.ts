// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  extractPriceText,
  isPrivateAddress,
  metaRefreshUrl,
  parseOpenGraph,
  PreviewError,
  validatePreviewUrl,
} from "../server/link-preview";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a9fe:a9fe",
    "2002:7f00:1::",
    "not-an-ip",
  ])("blocks %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "172.32.0.1", "151.101.1.69", "2606:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("validatePreviewUrl", () => {
  it("accepts public http and https links", () => {
    expect(validatePreviewUrl("https://www.airbnb.com/rooms/123#photos").toString()).toBe(
      "https://www.airbnb.com/rooms/123",
    );
    expect(validatePreviewUrl("http://zimmer.co.il/x").hostname).toBe("zimmer.co.il");
  });

  it.each([
    "ftp://example.com/file",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://localhost:3000",
    "http://foo.localhost/",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/admin",
    "http://intranet/",
    "http://printer.local/",
    "https://user:pass@example.com/",
    "https://example.com:8443/",
    "not a url",
    "",
    `https://example.com/${"a".repeat(2100)}`,
  ])("rejects %s", (url) => {
    expect(() => validatePreviewUrl(url)).toThrow(PreviewError);
  });

  it("rejects non-strings", () => {
    expect(() => validatePreviewUrl(42)).toThrow(PreviewError);
  });
});

describe("parseOpenGraph", () => {
  const html = `<!doctype html><html><head>
    <title>Fallback title</title>
    <meta content="צימר בגליל &amp; ג&#39;קוזי" property="og:title">
    <meta property='og:description' content='בקתה רומנטית עם נוף &quot;מטורף&quot;'>
    <meta property="og:image" content="/images/cabin.jpg">
    <meta property="og:site_name" content="Zimmer.co.il">
    <meta name="description" content="ignored because og wins">
  </head><body><p>מחיר: 1,250 ₪ ללילה</p></body></html>`;

  it("extracts og fields, decodes entities and resolves relative images", () => {
    const preview = parseOpenGraph(html, "https://www.zimmer.co.il/cabin/1");
    expect(preview.title).toBe("צימר בגליל & ג'קוזי");
    expect(preview.description).toBe('בקתה רומנטית עם נוף "מטורף"');
    expect(preview.image).toBe("https://www.zimmer.co.il/images/cabin.jpg");
    expect(preview.siteName).toBe("Zimmer.co.il");
    expect(preview.domain).toBe("zimmer.co.il");
    expect(preview.priceText).toBe("1,250 ₪");
    expect(preview.priceAmount).toBe(1250);
  });

  it("falls back to <title>, twitter tags and structured price", () => {
    const preview = parseOpenGraph(
      `<title> My  Cabin </title>
       <meta name="twitter:image" content="https://cdn.example.com/a.png">
       <meta property="product:price:amount" content="980">
       <meta property="product:price:currency" content="ILS">`,
      "https://example.com/",
    );
    expect(preview.title).toBe("My Cabin");
    expect(preview.image).toBe("https://cdn.example.com/a.png");
    expect(preview.priceAmount).toBe(980);
    expect(preview.priceText).toBe("₪980");
  });

  it("ignores non-http image urls", () => {
    const preview = parseOpenGraph(
      `<meta property="og:image" content="javascript:alert(1)">`,
      "https://example.com/",
    );
    expect(preview.image).toBeUndefined();
    expect(preview.title).toBeUndefined();
  });
});

describe("price and entity helpers", () => {
  it("finds shekel prices in several formats", () => {
    expect(extractPriceText("רק ₪ 850 ללילה")).toBe("₪ 850");
    expect(extractPriceText('החל מ-1200 ש"ח')).toBe('1200 ש"ח');
    expect(extractPriceText("no price here 2024")).toBeUndefined();
  });

  it("decodes numeric and named entities", () => {
    expect(decodeEntities("&#x5E9;&#1500;&#x05D5;&#1501; &amp; &nbsp;x")).toBe("שלום &  x");
  });

  it("finds meta refresh targets", () => {
    expect(
      metaRefreshUrl('<meta http-equiv="refresh" content="0; url=/next">', "https://a.com/x"),
    ).toBe("https://a.com/next");
    expect(metaRefreshUrl("<meta charset=utf-8>", "https://a.com/")).toBeUndefined();
  });
});

describe("api/link-preview handler", () => {
  const call = async (req: { method?: string; headers?: Record<string, string>; body?: unknown }) => {
    const { default: handler } = await import("../api/link-preview");
    const result: { status?: number; body?: any } = {};
    const res = {
      status(code: number) {
        result.status = code;
        return res;
      },
      json(data: unknown) {
        result.body = data;
      },
      setHeader() {},
    };
    await handler({ headers: {}, ...req }, res);
    return result;
  };

  it("only accepts POST", async () => {
    expect((await call({ method: "GET" })).status).toBe(405);
  });

  it("requires a bearer token before fetching anything", async () => {
    const result = await call({ method: "POST", body: { url: "https://example.com" } });
    expect(result.status).toBe(401);
  });
});
