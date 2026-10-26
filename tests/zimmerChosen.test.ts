import { describe, expect, it } from "vitest";
import {
  chosenWinnerId,
  filterZimmers,
  listingKey,
  sortZimmers,
  staleChosenIds,
  withSingleChosen,
} from "../src/lib/zimmers";

const z = (id: string, over: any = {}) =>
  ({ id, url: `https://x.co/${id}`, createdAt: 1, votes: {}, amenities: [], ...over }) as any;

describe("single chosen zimmer", () => {
  const list = [
    z("a", { chosen: true, chosenAt: 100 }),
    z("b", { chosen: true, chosenAt: 200 }),
    z("c"),
  ];
  it("picks the latest chosenAt, ties broken by id", () => {
    expect(chosenWinnerId(list)).toBe("b");
    expect(
      chosenWinnerId([z("a", { chosen: true, chosenAt: 5 }), z("b", { chosen: true, chosenAt: 5 })]),
    ).toBe("b");
    expect(chosenWinnerId([z("a", { chosen: true })])).toBe("a");
    expect(chosenWinnerId([z("a")])).toBeNull();
  });
  it("treats a missing chosenAt as oldest", () => {
    expect(chosenWinnerId([z("a", { chosen: true }), z("b", { chosen: true, chosenAt: 1 })])).toBe("b");
  });
  it("lists the stale docs to heal", () => {
    expect(staleChosenIds(list)).toEqual(["a"]);
    expect(staleChosenIds([z("a", { chosen: true, chosenAt: 1 })])).toEqual([]);
    expect(staleChosenIds([])).toEqual([]);
  });
  it("shows only the winner as chosen, keeping the array when consistent", () => {
    const fixed = withSingleChosen(list);
    expect(fixed.filter((item) => item.chosen).map((item) => item.id)).toEqual(["b"]);
    const single = [z("a", { chosen: true, chosenAt: 1 }), z("c")];
    expect(withSingleChosen(single)).toBe(single);
  });
  it("sort and filters use only the winner", () => {
    expect(sortZimmers(list, "added")[0].id).toBe("b");
    expect(sortZimmers(list, "added").filter((item) => item.chosen)).toHaveLength(1);
    expect(filterZimmers(list, "all").filter((item) => item.chosen)).toHaveLength(1);
  });
});

describe("listingKey", () => {
  it("ignores scheme, www, host case and trailing slashes", () => {
    const base = listingKey("https://example.com/rooms/1");
    expect(listingKey("http://WWW.Example.com/rooms/1/")).toBe(base);
    expect(listingKey("https://example.com/rooms/1#photos")).toBe(base);
  });
  it("drops tracking and search-context params", () => {
    expect(
      listingKey(
        "https://www.airbnb.com/rooms/123?check_in=2026-01-01&check_out=2026-01-03&guests=2&adults=2&source_impression_id=p3_1&utm_source=x&fbclid=abc",
      ),
    ).toBe(listingKey("https://airbnb.com/rooms/123"));
    expect(
      listingKey("https://booking.com/hotel/il/x.html?aid=1&label=l&sid=s&gclid=g"),
    ).toBe(listingKey("https://booking.com/hotel/il/x.html"));
  });
  it("keeps the path and params that identify the listing, in any order", () => {
    expect(listingKey("https://a.com/p?id=1&x=2")).toBe(listingKey("https://a.com/p?x=2&id=1"));
    expect(listingKey("https://a.com/p?id=1")).not.toBe(listingKey("https://a.com/p?id=2"));
    expect(listingKey("https://a.com/rooms/1")).not.toBe(listingKey("https://a.com/rooms/2"));
    expect(listingKey("https://a.com/Rooms/1")).not.toBe(listingKey("https://a.com/rooms/1"));
  });
  it("falls back to the trimmed input for invalid urls", () => {
    expect(listingKey(" not a url ")).toBe("not a url");
  });
});
