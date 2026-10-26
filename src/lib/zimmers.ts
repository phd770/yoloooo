import type { Zimmer, ZimmerVote } from "./types";

export const ZIMMER_PROFILES = ["boaz", "mishel"] as const;

export const AMENITIES = [
  { id: "private_pool", label: "בריכה פרטית" },
  { id: "jacuzzi", label: "ג'קוזי" },
  { id: "heated_pool", label: "בריכה מחוממת" },
  { id: "sauna", label: "סאונה" },
  { id: "view", label: "נוף" },
  { id: "kitchen", label: "מטבח מאובזר" },
  { id: "breakfast", label: "ארוחת בוקר" },
  { id: "parking", label: "חניה" },
  { id: "full_privacy", label: "פרטיות מלאה" },
  { id: "couples", label: "מתאים לזוגות" },
] as const;

export const AMENITY_LABELS: Record<string, string> = Object.fromEntries(
  AMENITIES.map((item) => [item.id, item.label]),
);

export const VOTES: { id: ZimmerVote; emoji: string; label: string }[] = [
  { id: "like", emoji: "👍", label: "אהבתי" },
  { id: "maybe", emoji: "🤔", label: "אולי" },
  { id: "dislike", emoji: "👎", label: "לא אהבתי" },
];

export type ZimmerFilter = "all" | "match" | "undecided" | "rejected" | "archived";
export type ZimmerSort = "added" | "price" | "match";

/** Pull the first link out of pasted text (e.g. a shared message) and normalize it. */
export function normalizeListingUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const found =
    text.match(/https?:\/\/[^\s<>"']+/i)?.[0] ??
    text.match(/(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>"']*)?/i)?.[0];
  if (!found) return null;
  const candidate = /^https?:\/\//i.test(found) ? found : `https://${found}`;
  try {
    const url = new URL(candidate.replace(/[),.;!?]+$/, ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    if (url.toString().length > 2048) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 80);
  }
}

/** Whole nights between two YYYY-MM-DD dates, or null if invalid. */
export function nightsBetween(checkIn?: string, checkOut?: string): number | null {
  if (!checkIn || !checkOut) return null;
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const nights = Math.round((end - start) / 86_400_000);
  return nights > 0 ? nights : null;
}

export function effectiveNights(zimmer: Pick<Zimmer, "nights" | "checkIn" | "checkOut">) {
  return zimmer.nights && zimmer.nights > 0
    ? zimmer.nights
    : nightsBetween(zimmer.checkIn, zimmer.checkOut);
}

export function totalPrice(
  zimmer: Pick<Zimmer, "pricePerNight" | "nights" | "checkIn" | "checkOut">,
): number | null {
  const nights = effectiveNights(zimmer);
  const price = zimmer.pricePerNight;
  return price && price > 0 && nights ? Math.round(price * nights) : null;
}

export function partnerOf(userId: string): string {
  return userId === "boaz" ? "mishel" : "boaz";
}

export function isMatch(zimmer: Pick<Zimmer, "votes">): boolean {
  return ZIMMER_PROFILES.every((id) => zimmer.votes?.[id] === "like");
}

export function isRejected(zimmer: Pick<Zimmer, "votes">): boolean {
  return ZIMMER_PROFILES.some((id) => zimmer.votes?.[id] === "dislike");
}

export function isUndecided(zimmer: Pick<Zimmer, "votes">): boolean {
  return !isMatch(zimmer) && !isRejected(zimmer);
}

/** Higher is better: both liked beats one like, "maybe" counts a little, dislikes sink. */
export function matchScore(zimmer: Pick<Zimmer, "votes">): number {
  const weights: Record<ZimmerVote, number> = { like: 2, maybe: 1, dislike: -3 };
  const sum = ZIMMER_PROFILES.reduce((total, id) => {
    const vote = zimmer.votes?.[id];
    return total + (vote ? weights[vote] : 0);
  }, 0);
  return isMatch(zimmer) ? sum + 10 : sum;
}

/** Clicking the current vote again clears it. */
export function nextVote(
  current: ZimmerVote | undefined,
  clicked: ZimmerVote,
): ZimmerVote | null {
  return current === clicked ? null : clicked;
}

export function toggleInList(list: readonly string[] | undefined, value: string): string[] {
  const items = list ?? [];
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

export function filterZimmers(zimmers: Zimmer[], filter: ZimmerFilter): Zimmer[] {
  return zimmers.filter((zimmer) => {
    if (filter === "archived") return !!zimmer.archived;
    if (zimmer.archived) return false;
    if (filter === "match") return isMatch(zimmer);
    if (filter === "undecided") return isUndecided(zimmer);
    if (filter === "rejected") return isRejected(zimmer);
    return true;
  });
}

/** Sort a list; the chosen zimmer is always pinned first. */
export function sortZimmers(zimmers: Zimmer[], sort: ZimmerSort): Zimmer[] {
  const priceKey = (zimmer: Zimmer) =>
    totalPrice(zimmer) ?? zimmer.pricePerNight ?? Number.POSITIVE_INFINITY;
  return [...zimmers].sort((a, b) => {
    if (!!a.chosen !== !!b.chosen) return a.chosen ? -1 : 1;
    if (sort === "price") {
      const diff = priceKey(a) - priceKey(b);
      if (diff) return diff;
    } else if (sort === "match") {
      const diff = matchScore(b) - matchScore(a);
      if (diff) return diff;
    }
    return b.createdAt - a.createdAt;
  });
}

export function formatPrice(value: number | null | undefined): string {
  return value ? `₪${Math.round(value).toLocaleString("he-IL")}` : "";
}

export function formatDateRange(checkIn?: string, checkOut?: string): string {
  const format = (value: string) => {
    const [year, month, day] = value.split("-");
    return year && month && day ? `${Number(day)}.${Number(month)}` : value;
  };
  if (checkIn && checkOut) return `${format(checkIn)}–${format(checkOut)}`;
  return checkIn ? `מ־${format(checkIn)}` : checkOut ? `עד ${format(checkOut)}` : "";
}
