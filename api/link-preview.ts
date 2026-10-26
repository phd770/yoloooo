import { pinServices } from "../server/pin.js";
import { fetchLinkPreview, PreviewError } from "../server/link-preview.js";

type Request = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
type Response = {
  status(code: number): Response;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
};

/** Server-side Open Graph preview for a zimmer listing link. Signed-in partners only. */
export default async function handler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer "))
    return res.status(401).json({ error: "יש להתחבר מחדש" });
  let body: any;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "בקשה לא תקינה" });
  }
  if (!body || typeof body.url !== "string")
    return res.status(400).json({ error: "בקשה לא תקינה" });
  let uid: string;
  try {
    const { auth } = pinServices();
    try {
      uid = (await auth.verifyIdToken(authorization.slice(7), true)).uid;
    } catch {
      return res.status(401).json({ error: "יש להתחבר מחדש" });
    }
  } catch {
    return res.status(503).json({ error: "השירות לא זמין כרגע. נסו שוב." });
  }
  if (!["boaz", "mishel"].includes(uid))
    return res.status(403).json({ error: "אין הרשאה" });
  try {
    return res.status(200).json({ preview: await fetchLinkPreview(body.url) });
  } catch (error) {
    if (error instanceof PreviewError)
      return res.status(error.status).json({ error: error.message });
    console.error(
      "[link-preview] failed",
      error instanceof Error ? error.message : "unknown",
    );
    return res.status(502).json({ error: "לא הצלחנו לקרוא את פרטי הקישור" });
  }
}
