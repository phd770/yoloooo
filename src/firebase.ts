import { initializeApp } from "firebase/app";
import {
  clearIndexedDbPersistence,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
  terminate,
  waitForPendingWrites,
} from "firebase/firestore";
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
function createFirestore() {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId,
    );
  } catch {
    // IndexedDB unavailable (private mode, iOS quirks): use the in-memory cache.
    try {
      return initializeFirestore(
        app,
        { localCache: memoryLocalCache() },
        firebaseConfig.firestoreDatabaseId,
      );
    } catch {
      return getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
  }
}
export const db = createFirestore();
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
  await signInWithCustomToken(auth, data.token);
}

/** Wake the login function (and its Firestore/Auth clients) before the PIN is submitted. */
export function warmUpLogin(): void {
  fetch("/api/auth", { method: "GET", cache: "no-store" }).catch(() => {});
}

export async function signOutFromApp(): Promise<void> {
  await signOut(auth);
  // The cache holds private chat data: wipe it with the rest of the local
  // state. A terminated Firestore instance is unusable, so reload afterwards.
  try {
    await Promise.race([
      waitForPendingWrites(db),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]).catch(() => {});
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    // Memory cache or IndexedDB unavailable: nothing persisted to wipe.
  }
  window.location.reload();
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
