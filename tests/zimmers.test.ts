import { describe, expect, it } from "vitest";
import type { Zimmer } from "../src/lib/types";
import {
  filterZimmers,
  isMatch,
  isRejected,
  isUndecided,
  matchScore,
  nextVote,
  nightsBetween,
  normalizeListingUrl,
  partnerOf,
  sortZimmers,
  toggleInList,
  totalPrice,
} from "../src/lib/zimmers";

const zimmer = (id: string, extra: Partial<Zimmer> = {}): Zimmer => ({
  id,
  url: `https://example.com/${id}`,
  title: id,
  amenities: [],
  votes: {},
  createdBy: "boaz",
  createdAt: 0,
  ...extra,
});

describe("votes and match", () => {
  it("matches only when both partners liked", () => {
    expect(isMatch(zimmer("a", { votes: { boaz: "like", mishel: "like" } }))).toBe(true);
    expect(isMatch(zimmer("b", { votes: { boaz: "like", mishel: "maybe" } }))).toBe(false);
    expect(isMatch(zimmer("c", { votes: { boaz: "like" } }))).toBe(false);
  });

  it("classifies rejected and undecided", () => {
    const rejected = zimmer("r", { votes: { boaz: "like", mishel: "dislike" } });
    expect(isRejected(rejected)).toBe(true);
    expect(isUndecided(rejected)).toBe(false);
    expect(isUndecided(zimmer("u", { votes: { mishel: "maybe" } }))).toBe(true);
    expect(isUndecided(zimmer("e"))).toBe(true);
  });

  it("toggles a vote off when clicked again", () => {
    expect(nextVote(undefined, "like")).toBe("like");
    expect(nextVote("like", "like")).toBeNull();
    expect(nextVote("like", "maybe")).toBe("maybe");
  });

  it("scores matches above single likes and dislikes last", () => {
    const both = matchScore(zimmer("a", { votes: { boaz: "like", mishel: "like" } }));
    const one = matchScore(zimmer("b", { votes: { boaz: "like", mishel: "maybe" } }));
    const none = matchScore(zimmer("c"));
    const bad = matchScore(zimmer("d", { votes: { boaz: "like", mishel: "dislike" } }));
    expect(both).toBeGreaterThan(one);
    expect(one).toBeGreaterThan(none);
    expect(none).toBeGreaterThan(bad);
  });

  it("knows each user's partner", () => {
    expect(partnerOf("boaz")).toBe("mishel");
    expect(partnerOf("mishel")).toBe("boaz");
  });
});

describe("filters and sorting", () => {
  const list = [
    zimmer("match", { createdAt: 1, votes: { boaz: "like", mishel: "like" }, pricePerNight: 900, nights: 2 }),
    zimmer("rejected", { createdAt: 2, votes: { boaz: "dislike" }, pricePerNight: 300, nights: 2 }),
    zimmer("open", { createdAt: 3, pricePerNight: 500 }),
    zimmer("archived", { createdAt: 4, archived: true }),
    zimmer("chosen", { createdAt: 0, chosen: true, pricePerNight: 2000, nights: 2 }),
  ];

  it("filters by status and keeps archived separate", () => {
    const ids = (items: Zimmer[]) => items.map((item) => item.id).sort();
    expect(ids(filterZimmers(list, "all"))).toEqual(["chosen", "match", "open", "rejected"]);
    expect(ids(filterZimmers(list, "match"))).toEqual(["match"]);
    expect(ids(filterZimmers(list, "rejected"))).toEqual(["rejected"]);
    expect(ids(filterZimmers(list, "undecided"))).toEqual(["chosen", "open"]);
    expect(ids(filterZimmers(list, "archived"))).toEqual(["archived"]);
  });

  it("pins the chosen zimmer and sorts the rest", () => {
    const active = filterZimmers(list, "all");
    expect(sortZimmers(active, "added").map((z) => z.id)).toEqual(["chosen", "open", "rejected", "match"]);
    expect(sortZimmers(active, "price").map((z) => z.id)).toEqual(["chosen", "open", "rejected", "match"]);
    expect(sortZimmers(active, "match").map((z) => z.id)[1]).toBe("match");
  });
});

describe("prices and dates", () => {
  it("computes nights from dates and the total price", () => {
    expect(nightsBetween("2026-11-01", "2026-11-03")).toBe(2);
    expect(nightsBetween("2026-11-03", "2026-11-01")).toBeNull();
    expect(totalPrice({ pricePerNight: 850, checkIn: "2026-11-01", checkOut: "2026-11-04" })).toBe(2550);
    expect(totalPrice({ pricePerNight: 850, nights: 2, checkIn: "2026-11-01", checkOut: "2026-11-04" })).toBe(1700);
    expect(totalPrice({ pricePerNight: 850 })).toBeNull();
  });

  it("toggles list values", () => {
    expect(toggleInList(["sauna"], "view")).toEqual(["sauna", "view"]);
    expect(toggleInList(["sauna", "view"], "sauna")).toEqual(["view"]);
    expect(toggleInList(undefined, "view")).toEqual(["view"]);
  });
});

describe("normalizeListingUrl", () => {
  it("extracts and normalizes links from pasted text", () => {
    expect(normalizeListingUrl("https://www.airbnb.co.il/rooms/42?x=1")).toBe(
      "https://www.airbnb.co.il/rooms/42?x=1",
    );
    expect(normalizeListingUrl("תראי את זה! https://www.booking.com/hotel/il/a.html.")).toBe(
      "https://www.booking.com/hotel/il/a.html",
    );
    expect(normalizeListingUrl("zimmer.co.il/cabin/7")).toBe("https://zimmer.co.il/cabin/7");
  });

  it("rejects text without a link", () => {
    expect(normalizeListingUrl("")).toBeNull();
    expect(normalizeListingUrl("סתם טקסט")).toBeNull();
    expect(normalizeListingUrl("javascript:alert(1)")).toBeNull();
  });
});
