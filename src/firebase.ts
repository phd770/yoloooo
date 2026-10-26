import { initializeApp } from "firebase/app";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getStorage } from "firebase/storage";
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
export const storage = getStorage(app);
export const auth = getAuth(app);
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, pin }),
      signal: controller.signal,
    });
  } catch {
    throw new Error("החיבור לשרת לא הושלם. הקוד נשמר ואפשר לנסות שוב.");
  } finally {
    clearTimeout(timeout);
  }
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
  await signInWithCustomToken(auth, data.token);
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
