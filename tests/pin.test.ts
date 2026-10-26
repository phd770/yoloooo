import { describe, expect, it } from "vitest";
import {
  MAX_PIN_ATTEMPTS,
  PIN_WINDOW_MS,
  clearPinAttempts,
  hashPin,
  pinMatches,
  reservePinAttempt,
  withTimeout,
} from "../server/pin";

function fakeDb() {
  const store = new Map<string, any>();
  const ref = (path: string) => ({ path });
  return {
    store,
    doc: ref,
    runTransaction: async (fn: (t: any) => Promise<boolean>) =>
      fn({
        get: async (r: any) => ({ data: () => store.get(r.path) }),
        set: (r: any, value: any) => store.set(r.path, value),
      }),
  } as any;
}
function dbWithDelete() {
  const db = fakeDb();
  db.doc = (path: string) => ({ path, delete: async () => db.store.delete(path) });
  return db;
}

describe("pin hashing", () => {
  it("accepts the right pin and rejects others", () => {
    const hash = hashPin("1234");
    expect(pinMatches("1234", hash)).toBe(true);
    expect(pinMatches("1235", hash)).toBe(false);
    expect(pinMatches("12", hash)).toBe(false);
    expect(pinMatches("1234", undefined)).toBe(false);
    expect(pinMatches("1234", "garbage")).toBe(false);
  });
  it("rejects non four-digit pins when hashing", () => {
    expect(() => hashPin("12a4")).toThrow();
  });
});

describe("reservePinAttempt", () => {
  it("allows MAX attempts then locks out", async () => {
    const db = dbWithDelete();
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++)
      expect(await reservePinAttempt(db, "1.1.1.1", 1000)).toBe(true);
    expect(await reservePinAttempt(db, "1.1.1.1", 1000)).toBe(false);
  });
  it("tracks IPs separately", async () => {
    const db = dbWithDelete();
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++)
      await reservePinAttempt(db, "a", 1000);
    expect(await reservePinAttempt(db, "b", 1000)).toBe(true);
  });
  it("unlocks after the window expires", async () => {
    const db = dbWithDelete();
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++)
      await reservePinAttempt(db, "a", 1000);
    expect(await reservePinAttempt(db, "a", 1000 + PIN_WINDOW_MS + 1)).toBe(true);
  });
  it("clearPinAttempts resets the counter", async () => {
    const db = dbWithDelete();
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++)
      await reservePinAttempt(db, "a", 1000);
    await clearPinAttempts(db, "a");
    expect(await reservePinAttempt(db, "a", 1000)).toBe(true);
  });
});

describe("withTimeout", () => {
  it("resolves with the value when fast", async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });
  it("rejects when the promise hangs", async () => {
    await expect(withTimeout(new Promise(() => {}), 20)).rejects.toThrow("Timed out");
  });
  it("propagates the original rejection", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 50)).rejects.toThrow("boom");
  });
});
