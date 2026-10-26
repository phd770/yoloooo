import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  pinMatches,
  pinServices,
  reservePinAttempt,
  clearPinAttempts,
  withTimeout,
} from "../server/pin.js";
import { VAULT_CODE_HASHES } from "../server/vault-codes.js";
type Request = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};
type Response = {
  status(code: number): Response;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
};
function signature(payload: string) {
  const secret = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!secret) throw new Error("Missing server configuration");
  return createHmac("sha256", secret)
    .update(`vault-first-step:${payload}`)
    .digest("base64url");
}
export function issueVaultChallenge(uid: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      expires: now + 5 * 60 * 1000,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function validVaultChallenge(
  challenge: unknown,
  uid: string,
  now = Date.now(),
) {
  if (typeof challenge !== "string" || challenge.length > 1024) return false;
  try {
    const [payload, supplied, extra] = challenge.split(".");
    if (!payload || !supplied || extra !== undefined) return false;
    const expected = Buffer.from(signature(payload));
    const actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      data.uid === uid && Number.isFinite(data.expires) && data.expires > now
    );
  } catch {
    return false;
  }
}
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let body: any;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid request" });
  }
  if (
    !body ||
    ![1, 2].includes(body.step) ||
    typeof body.pin !== "string" ||
    !/^\d{4}$/.test(body.pin)
  )
    return res.status(400).json({ error: "Invalid request" });
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer "))
    return res.status(401).json({ error: "יש להתחבר מחדש" });
  try {
    const { auth, db } = pinServices();
    let uid: string;
    try {
      uid = (
        await withTimeout(
          auth.verifyIdToken(authorization.slice(7), true),
          8000,
        )
      ).uid;
    } catch {
      return res.status(401).json({ error: "יש להתחבר מחדש" });
    }
    if (!["boaz", "mishel"].includes(uid))
      return res.status(403).json({ error: "אין הרשאה" });
    if (body.step === 2 && !validVaultChallenge(body.challenge, uid))
      return res.status(409).json({ error: "יש להתחיל שוב מהקוד הראשון" });
    const ip = String(
      req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
    )
      .split(",")[0]
      .trim();
    const key = `vault:${uid}:${body.step}:${ip}`;
    if (!(await withTimeout(reservePinAttempt(db, key), 8000))) {
      res.setHeader("Retry-After", "900");
      return res
        .status(429)
        .json({ error: "בוצעו יותר מדי ניסיונות. נסו בעוד 15 דקות." });
    }
    if (!pinMatches(body.pin, VAULT_CODE_HASHES[body.step - 1]))
      return res.status(403).json({ error: "הקוד שגוי. נסו שוב." });
    void clearPinAttempts(db, key).catch(() => {});
    return res
      .status(200)
      .json(
        body.step === 1
          ? { challenge: issueVaultChallenge(uid) }
          : { unlocked: true },
      );
  } catch {
    return res
      .status(503)
      .json({ error: "לא ניתן לפתוח את הכספת כרגע. נסו שוב." });
  }
}
