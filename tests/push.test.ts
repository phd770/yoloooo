import { describe, expect, it } from "vitest";
import { needsIosInstall, subscriptionExpired, subscriptionKeyDiffers, vapidKey } from "../src/lib/pushUtils";
import { isDeadSubscription } from "../api/push";

const KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

describe("pushUtils", () => {
  it("decodes a VAPID key to 65 bytes", () => {
    expect(vapidKey(KEY).byteLength).toBe(65);
  });
  it("detects a different applicationServerKey", () => {
    expect(subscriptionKeyDiffers(vapidKey(KEY), KEY)).toBe(false);
    const other = new Uint8Array(vapidKey(KEY));
    other[0] ^= 1;
    expect(subscriptionKeyDiffers(other.buffer, KEY)).toBe(true);
    expect(subscriptionKeyDiffers(null, KEY)).toBe(false);
  });
  it("requires install on iOS only when not standalone", () => {
    const ios = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
    expect(needsIosInstall(ios, false)).toBe(true);
    expect(needsIosInstall(ios, true)).toBe(false);
    expect(needsIosInstall("Mozilla/5.0 (Linux; Android 14)", false)).toBe(false);
  });
  it("flags expired subscriptions", () => {
    expect(subscriptionExpired(null)).toBe(false);
    expect(subscriptionExpired(100, 200)).toBe(true);
    expect(subscriptionExpired(300, 200)).toBe(false);
  });
});

describe("isDeadSubscription", () => {
  it("is true for 404 and 410 only", () => {
    expect(isDeadSubscription({ statusCode: 404 })).toBe(true);
    expect(isDeadSubscription({ statusCode: 410 })).toBe(true);
    expect(isDeadSubscription({ statusCode: 500 })).toBe(false);
    expect(isDeadSubscription(new Error("x"))).toBe(false);
    expect(isDeadSubscription(undefined)).toBe(false);
  });
});
