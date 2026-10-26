import {
  clearPinAttempts,
  hashPin,
  pinMatches,
  pinServices,
  reservePinAttempt,
  withTimeout,
} from "../server/pin.js";
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
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    // Warm-up ping from the login screen: pays the cold start before the PIN is typed.
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) pinServices();
    } catch {
      // Ignore: the real login request reports configuration problems.
    }
    return res.status(200).json({});
  }
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
    !["boaz", "mishel"].includes(body.profile) ||
    typeof body.pin !== "string" ||
    !/^\d{4}$/.test(body.pin)
  )
    return res.status(400).json({ error: "Invalid request" });
  const { profile, pin, newPin } = body;
  if (
    newPin !== undefined &&
    (typeof newPin !== "string" || !/^\d{4}$/.test(newPin))
  )
    return res.status(400).json({ error: "Invalid request" });
  const envHash =
    profile === "boaz"
      ? process.env.PIN_BOAZ_HASH
      : process.env.PIN_MISHEL_HASH;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !envHash)
    return res.status(503).json({ error: "שירות הכניסה לא הוגדר עדיין" });
  try {
    const { auth, db } = pinServices();
    if (newPin !== undefined) {
      const authorization = req.headers.authorization;
      if (
        typeof authorization !== "string" ||
        !authorization.startsWith("Bearer ")
      )
        return res.status(401).json({ error: "יש להתחבר מחדש" });
      try {
        const identity = await auth.verifyIdToken(authorization.slice(7), true);
        if (identity.uid !== profile)
          return res.status(403).json({ error: "אין הרשאה" });
      } catch {
        return res.status(401).json({ error: "יש להתחבר מחדש" });
      }
    }
    const ip = String(
      req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
    )
      .split(",")[0]
      .trim();
    const pinRef = db.doc(`private_pin_codes/${profile}`);
    // Independent reads: run together instead of one after the other.
    const [allowed, saved] = await withTimeout(
      Promise.all([reservePinAttempt(db, ip), pinRef.get()]),
      8000,
    );
    if (!allowed) {
      res.setHeader("Retry-After", "900");
      return res
        .status(429)
        .json({ error: "בוצעו יותר מדי ניסיונות. נסו בעוד 15 דקות." });
    }
    if (!pinMatches(pin, saved.data()?.hash || envHash))
      return res.status(401).json({ error: "קוד שגוי" });
    if (newPin !== undefined) {
      // Recheck inside the transaction: two concurrent changes cannot overwrite each other.
      await db.runTransaction(async (transaction) => {
        const latest = await transaction.get(pinRef);
        if (!pinMatches(pin, latest.data()?.hash || envHash))
          throw new Error("PIN changed");
        transaction.set(pinRef, {
          hash: hashPin(newPin),
          updatedAt: Date.now(),
        });
      });
      await clearPinAttempts(db, ip).catch(() => {});
      return res.status(200).json({ updated: true });
    }
    const [token] = await withTimeout(
      Promise.all([
        auth.createCustomToken(profile, { profile }),
        clearPinAttempts(db, ip).catch(() => {}),
      ]),
      8000,
    );
    return res.status(200).json({ token });
  } catch {
    return res
      .status(503)
      .json({ error: "שירות הכניסה לא זמין כרגע. נסו שוב מאוחר יותר." });
  }
}
