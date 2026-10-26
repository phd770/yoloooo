import { beforeEach, describe, expect, it, vi } from "vitest";

const clear = vi.fn();
vi.mock("../server/pin.js", async () => {
  const actual = await vi.importActual<typeof import("../server/pin")>("../server/pin");
  return {
    ...actual,
    pinServices: () => ({
      auth: { createCustomToken: async () => "tok" },
      db: { doc: () => ({ get: async () => ({ data: () => undefined }) }) },
    }),
    reservePinAttempt: async () => true,
    clearPinAttempts: (...args: unknown[]) => clear(...args),
  };
});

import handler from "../api/auth";
import { hashPin } from "../server/pin";

function run() {
  const out: { status?: number; body?: any } = {};
  const res: any = {
    status(code: number) { out.status = code; return res; },
    json(body: unknown) { out.body = body; },
    setHeader() {},
  };
  return handler(
    { method: "POST", body: { profile: "boaz", pin: "1234" }, headers: {} },
    res,
  ).then(() => out);
}

describe("api/auth login", () => {
  beforeEach(() => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "{}";
    process.env.PIN_BOAZ_HASH = hashPin("1234");
  });

  it("returns a token even when clearing attempts hangs", async () => {
    clear.mockReturnValue(new Promise(() => {}));
    expect(await run()).toEqual({ status: 200, body: { token: "tok" } });
  });

  it("returns a token even when clearing attempts fails", async () => {
    clear.mockRejectedValue(new Error("down"));
    expect(await run()).toEqual({ status: 200, body: { token: "tok" } });
  });
});
