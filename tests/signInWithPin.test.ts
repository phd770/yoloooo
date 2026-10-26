import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/app", () => ({ initializeApp: () => ({}) }));
vi.mock("firebase/firestore", () => ({ getFirestore: () => ({}), setLogLevel: () => {} }));
vi.mock("firebase/storage", () => ({ getStorage: () => ({}) }));
const signInWithCustomToken = vi.fn(async () => {});
vi.mock("firebase/auth", () => ({
  inMemoryPersistence: {},
  getAuth: () => ({}),
  setPersistence: async () => {},
  signOut: async () => {},
  signInWithCustomToken: (...args: unknown[]) => signInWithCustomToken(...(args as [])),
}));

import { signInWithPin } from "../src/firebase";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("signInWithPin retry behavior", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("retries once after a 5xx and then signs in", async () => {
    fetchMock
      .mockResolvedValueOnce(json(503, { error: "x" }))
      .mockResolvedValueOnce(json(200, { token: "t" }));
    await signInWithPin("boaz", "1234");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signInWithCustomToken).toHaveBeenCalledWith(expect.anything(), "t");
  });

  it("retries once after a network error", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(json(200, { token: "t" }));
    await signInWithPin("boaz", "1234");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("network"));
    await expect(signInWithPin("boaz", "1234")).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 401", async () => {
    fetchMock.mockResolvedValue(json(401, { error: "bad" }));
    await expect(signInWithPin("boaz", "1234")).rejects.toThrow("הקוד שגוי");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 429", async () => {
    fetchMock.mockResolvedValue(json(429, { error: "limit" }));
    await expect(signInWithPin("boaz", "1234")).rejects.toThrow("יותר מדי");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
