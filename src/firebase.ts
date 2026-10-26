import { initializeApp } from "firebase/app";
import { getFirestore, setLogLevel } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";
import {
  inMemoryPersistence,
  getAuth,
  setPersistence,
  signInWithCustomToken,
  signOut,
} from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
setLogLevel("error");
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// The storage SDK is only needed for vault media and chat attachments, not
// at boot: load it on first use instead of pulling it into the initial bundle.
let storagePromise: Promise<FirebaseStorage> | null = null;
export function getStorageLazy(): Promise<FirebaseStorage> {
  if (!storagePromise)
    storagePromise = import("firebase/storage").then(({ getStorage }) =>
      getStorage(app),
    );
  return storagePromise;
}
// Clear any identity saved by older versions, then keep new sessions in memory only.
const authPersistenceReady = (async () => {
  await setPersistence(auth, inMemoryPersistence);
  await signOut(auth);
})();
export const ALLOWED_PROFILE_IDS = ["boaz", "mishel"] as const;
export type AllowedProfileId = (typeof ALLOWED_PROFILE_IDS)[number];

export async function waitForAuthState(): Promise<void> {
  await authPersistenceReady;
  await auth.authStateReady();
}

export function ensureAuthenticated(): Promise<void> {
  return waitForAuthState().then(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !ALLOWED_PROFILE_IDS.includes(uid as AllowedProfileId)) {
      throw new Error("יש להתחבר כדי להמשיך");
    }
  });
}

export async function signInWithPin(
  profile: AllowedProfileId,
  pin: string,
): Promise<void> {
  await authPersistenceReady;
  // One automatic retry on timeout, network error or 5xx: the first request often
  // lands on a cold serverless instance.
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2 && !response; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const result = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, pin }),
        signal: controller.signal,
      });
      if (result.status < 500 || attempt === 1) response = result;
    } catch {
      if (attempt === 1)
        throw new Error("החיבור לשרת לא הושלם. הקוד נשמר ואפשר לנסות שוב.");
    } finally {
      clearTimeout(timeout);
    }
  }
  if (!response) throw new Error("החיבור לשרת לא הושלם. הקוד נשמר ואפשר לנסות שוב.");
  if (response.status === 401) throw new Error("הקוד שגוי. נסו שוב.");
  if (response.status === 429)
    throw new Error("בוצעו יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.");
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    throw new Error(
      "הכניסה לא זמינה כרגע בגלל תקלה באתר. אין צורך לחבר חשבון גוגל.",
    );
  }
  const data = (await response.json()) as { token?: string };
  if (!data.token) throw new Error("לא התקבל אישור כניסה");
  // The PIN is already verified here; this step talks to Google directly and is
  // what browser blockers or flaky networks break, so it gets its own timeout and message.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      signInWithCustomToken(auth, data.token),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 15000);
      }),
    ]);
  } catch (cause) {
    const code = (cause as { code?: string })?.code ?? (cause as Error)?.message ?? "unknown";
    console.error("signInWithCustomToken failed", cause);
    throw new Error(
      code === "auth/network-request-failed" || code === "timeout"
        ? `הקוד אושר, אבל הדפדפן לא הצליח להתחבר לשרת ההתחברות של Google. נסו בלי חוסם פרסומות או בחלון פרטי. (${code})`
        : `הקוד אושר, אבל הכניסה נכשלה בשלב האחרון. (${code})`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Wake the login function (and its Firestore/Auth clients) before the PIN is submitted. */
export function warmUpLogin(): void {
  fetch("/api/auth", { method: "GET", cache: "no-store" }).catch(() => {});
}

export async function signOutFromApp(): Promise<void> {
  await signOut(auth);
}

export async function changePin(pin: string, newPin: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !/^\d{4}$/.test(pin) || !/^\d{4}$/.test(newPin))
    throw new Error("יש להזין קודים בני 4 ספרות");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ profile: user.uid, pin, newPin }),
      signal: controller.signal,
    });
    if (response.status === 401)
      throw new Error("הקוד הנוכחי שגוי או שהכניסה פגה");
    if (response.status === 429)
      throw new Error("יש להמתין 15 דקות לפני ניסיון נוסף");
    if (!response.ok) throw new Error("הקוד לא עודכן. נסו שוב.");
    const result = await response.json();
    if (!result.updated) throw new Error("לא התקבל אישור לשינוי הקוד");
  } finally {
    clearTimeout(timeout);
  }
}
