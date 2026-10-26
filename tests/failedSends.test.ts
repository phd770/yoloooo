import { beforeEach, describe, expect, it } from "vitest";
import {
  failedSendsKey,
  loadFailedSends,
  removeFailedSend,
  saveFailedSend,
} from "../src/lib/failedSends";

const key = failedSendsKey("boaz");
const entry = (id: string) => ({
  id,
  message: { id, text: "hi", createdAt: 1, senderId: "boaz", receiverId: "mishel" } as any,
  args: ["hi", undefined, undefined, false, undefined, undefined, undefined, false, undefined, undefined, id],
});

describe("failedSends", () => {
  beforeEach(() => sessionStorage.clear());

  it("round-trips entries and restores undefined args", () => {
    expect(saveFailedSend(key, entry("a"))).toBe(true);
    const [loaded] = loadFailedSends(key);
    expect(loaded.id).toBe("a");
    expect(loaded.args).toEqual(entry("a").args);
    expect(loaded.args[1]).toBeUndefined();
  });

  it("replaces an entry with the same id and keeps others", () => {
    saveFailedSend(key, entry("a"));
    saveFailedSend(key, entry("b"));
    saveFailedSend(key, entry("a"));
    expect(loadFailedSends(key).map((value) => value.id).sort()).toEqual(["a", "b"]);
  });

  it("removes entries and the key when empty", () => {
    saveFailedSend(key, entry("a"));
    saveFailedSend(key, entry("b"));
    removeFailedSend(key, "a");
    expect(loadFailedSends(key).map((value) => value.id)).toEqual(["b"]);
    removeFailedSend(key, "b");
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it("ignores corrupt data", () => {
    sessionStorage.setItem(key, "{nope");
    expect(loadFailedSends(key)).toEqual([]);
    sessionStorage.setItem(key, JSON.stringify([{ id: 1 }, null, "x"]));
    expect(loadFailedSends(key)).toEqual([]);
  });

  it("reports a storage failure", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    try {
      expect(saveFailedSend(key, entry("a"))).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
