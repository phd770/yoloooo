import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, initializeFirestore } from "firebase-admin/firestore";
import config from "../firebase-applet-config.json" with { type: "json" };
export const PIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_PIN_ATTEMPTS = 5;
export function pinMatches(pin: string, encoded?: string): boolean {
  if (!/^\d{4}$/.test(pin) || !encoded) return false;
  const parts = encoded.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const salt = Buffer.from(parts[0], "base64");
  const wanted = Buffer.from(parts[1], "base64");
  if (!salt.length || salt.length > 128 || wanted.length !== 64) return false;
  return timingSafeEqual(wanted, scryptSync(pin, salt, 64));
}
export function hashPin(pin: string): string {
  if (!/^\d{4}$/.test(pin))
    throw new Error("PIN must contain exactly four digits");
  const salt = randomBytes(16);
  return `${salt.toString("base64")}:${scryptSync(pin, salt, 64).toString("base64")}`;
}
let cachedServices:
  | {
      app: App;
      auth: ReturnType<typeof getAuth>;
      db: ReturnType<typeof getFirestore>;
    }
  | undefined;

export function pinServices() {
  // Reused across warm invocations: re-parsing credentials and re-opening a
  // Firestore channel on every request made each login pay a cold start.
  if (cachedServices) return cachedServices;
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error("Server not configured");
  const app =
    getApps().find((app) => app.name === "pin-auth") ||
    initializeApp(
      {
        credential: cert(JSON.parse(credentials)),
        projectId: config.projectId,
        storageBucket: config.storageBucket,
      },
      "pin-auth",
    );
  // REST avoids the slow, sometimes hanging gRPC channel setup on serverless cold starts.
  cachedServices = {
    app,
    auth: getAuth(app),
    db: initializeFirestore(app, { preferRest: true }, config.firestoreDatabaseId),
  };
  return cachedServices;
}

/** Reject if a backend call hangs, so the client gets a fast, retryable error. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Timed out")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function reservePinAttempt(
  db: ReturnType<typeof getFirestore>,
  ip: string,
  now = Date.now(),
): Promise<boolean> {
  const key = createHash("sha256").update(ip).digest("hex");
  const ref = db.doc(`private_pin_attempts/${key}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.data();
    const active = previous && previous.resetAt > now;
    if (active && previous.count >= MAX_PIN_ATTEMPTS) return false;
    // Reserve before checking the PIN, so simultaneous requests cannot bypass the limit.
    transaction.set(ref, {
      count: active ? previous.count + 1 : 1,
      resetAt: active ? previous.resetAt : now + PIN_WINDOW_MS,
      expiresAt: new Date(now + PIN_WINDOW_MS),
    });
    return true;
  });
}

export async function clearPinAttempts(
  db: ReturnType<typeof getFirestore>,
  key: string,
) {
  await db
    .doc(
      `private_pin_attempts/${createHash("sha256").update(key).digest("hex")}`,
    )
    .delete();
}
