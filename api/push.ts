import { createHash } from "node:crypto";
import * as webpush from "web-push";
import { pinServices } from "../server/pin.js";

type Response = {
  status(code: number): Response;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
};
type Request = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
type StoredSubscription = {
  owner: "boaz" | "mishel";
  endpoint: string;
  keys: { auth: string; p256dh: string };
  updatedAt: number;
};
const ids = ["boaz", "mishel"] as const;
const minInterval = 30_000;

function validSubscription(value: any): value is StoredSubscription {
  if (!value || typeof value.endpoint !== "string" || value.endpoint.length > 2048 ||
      typeof value.keys?.auth !== "string" || typeof value.keys?.p256dh !== "string" ||
      value.keys.auth.length > 256 || value.keys.p256dh.length > 256) return false;
  try { return new URL(value.endpoint).protocol === "https:"; } catch { return false; }
}

export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey)
    return res.status(503).json({ error: "התראות פוש עדיין לא הוגדרו" });
  if (req.method === "GET")
    return res.status(200).json({ publicKey });
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer "))
    return res.status(401).json({ error: "יש להתחבר מחדש" });
  let body: any;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: "בקשה לא תקינה" }); }
  if (!body || !["subscribe", "send"].includes(body.action))
    return res.status(400).json({ error: "בקשה לא תקינה" });
  try {
    const { auth, db } = pinServices();
    const identity = await auth.verifyIdToken(authorization.slice(7), true);
    if (!ids.includes(identity.uid as (typeof ids)[number]))
      return res.status(403).json({ error: "אין הרשאה" });
    const uid = identity.uid as "boaz" | "mishel";
    if (body.action === "subscribe") {
      const subscription = body.subscription;
      if (!validSubscription(subscription))
        return res.status(400).json({ error: "מינוי התראות לא תקין" });
      const key = createHash("sha256").update(subscription.endpoint).digest("hex");
      await db.doc(`push_subscriptions/${key}`).set({
        owner: uid,
        endpoint: subscription.endpoint,
        keys: { auth: subscription.keys.auth, p256dh: subscription.keys.p256dh },
        updatedAt: Date.now(),
      } satisfies StoredSubscription);
      return res.status(200).json({ subscribed: true });
    }

    const recipient = uid === "boaz" ? "mishel" : "boaz";
    const subscriptions = await db.collection("push_subscriptions")
      .where("owner", "==", recipient).limit(20).get();
    if (subscriptions.empty)
      return res.status(409).json({ error: "הצד השני צריך להפעיל התראות בטלפון שלו" });
    const now = Date.now();
    const rateRef = db.doc(`push_rate/${uid}`);
    const allowed = await db.runTransaction(async (transaction) => {
      const previous = await transaction.get(rateRef);
      if (now - Number(previous.data()?.lastSentAt || 0) < minInterval) return false;
      transaction.set(rateRef, { lastSentAt: now });
      return true;
    });
    if (!allowed)
      return res.status(429).json({ error: "אפשר לשלוח התראה נוספת בעוד חצי דקה" });

    webpush.setVapidDetails("https://yoloooo.vercel.app", publicKey, privateKey);
    const sender = uid === "boaz" ? "שירן" : "קרן";
    const payload = JSON.stringify({
      title: `התראה מ${sender}`,
      body: `${sender} מחכה לך בצ׳אט`,
      url: "/?tab=chat",
      tag: "partner-ping",
    });
    const results = await Promise.allSettled(subscriptions.docs.map(async (item) => {
      const subscription = item.data() as StoredSubscription;
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        }, payload, { TTL: 120, urgency: "high" });
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410)
          await item.ref.delete();
        throw error;
      }
    }));
    const sent = results.filter((result) => result.status === "fulfilled").length;
    if (!sent)
      return res.status(502).json({ error: "לא הצלחנו למסור את ההתראה. כדאי להפעיל אותה מחדש בטלפון השני." });
    return res.status(200).json({ sent });
  } catch (error) {
    console.error("[push] request failed", error instanceof Error ? error.message : "unknown");
    return res.status(503).json({ error: "לא הצלחנו לשלוח את ההתראה כרגע" });
  }
}
