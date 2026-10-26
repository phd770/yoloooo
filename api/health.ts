import { getStorage } from "firebase-admin/storage";
import { pinServices, withTimeout } from "../server/pin.js";

type Response = {
  status(code: number): Response;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
};
type Health = { login: boolean; database: boolean; storage: boolean };
let cached: { until: number; checks: Health } | undefined;
let pending: Promise<Health> | undefined;

function validHash(value?: string) {
  if (!value) return false;
  const [salt, hash] = value.split(":");
  return Boolean(
    salt &&
    hash &&
    Buffer.from(salt, "base64").length &&
    Buffer.from(hash, "base64").length === 64,
  );
}

async function check(): Promise<Health> {
  const checks: Health = { login: false, database: false, storage: false };
  try {
    const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!credentials) return checks;
    // Shares the cached login app, so health checks never pay a separate cold init.
    const { app, db } = pinServices();
    checks.login =
      validHash(process.env.PIN_BOAZ_HASH) &&
      validHash(process.env.PIN_MISHEL_HASH);
    const results = await Promise.allSettled([
      withTimeout(db.doc("sessions/current").get(), 8000),
      withTimeout(getStorage(app).bucket().getMetadata(), 8000),
    ]);
    checks.database = results[0].status === "fulfilled";
    checks.storage = results[1].status === "fulfilled";
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const code = result.reason?.code;
        console.error(
          "[health]",
          index === 0 ? "database" : "storage",
          typeof code === "number" || typeof code === "string"
            ? code
            : "unknown",
        );
      }
    });
  } catch {
    // Never expose credentials, PIN hashes, or private records in health output.
  }
  return checks;
}

export default async function handler(req: { method?: string }, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });
  if (!cached || cached.until <= Date.now()) {
    pending ||= check()
      .then((checks) => {
        cached = { checks, until: Date.now() + 60000 };
        return checks;
      })
      .finally(() => {
        pending = undefined;
      });
    await pending;
  }
  const checks = cached!.checks;
  const healthy = Object.values(checks).every(Boolean);
  return res
    .status(healthy ? 200 : 503)
    .json({ status: healthy ? "ok" : "unavailable", checks });
}
