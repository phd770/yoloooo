export function vapidKey(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

/** True when an existing subscription was created with a different VAPID key (e.g. after key rotation). */
export function subscriptionKeyDiffers(
  existing: ArrayBuffer | null | undefined,
  publicKey: string,
): boolean {
  if (!existing) return false;
  const a = new Uint8Array(existing);
  const b = new Uint8Array(vapidKey(publicKey));
  return a.length !== b.length || a.some((byte, index) => byte !== b[index]);
}

/** iOS only delivers web push to installed (home-screen) web apps. */
export function needsIosInstall(userAgent: string, standalone: boolean): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) && !standalone;
}

/** Expiration time (ms epoch) from PushSubscription.expirationTime; null means no expiry. */
export function subscriptionExpired(expirationTime: number | null | undefined, now = Date.now()): boolean {
  return typeof expirationTime === "number" && expirationTime <= now;
}
