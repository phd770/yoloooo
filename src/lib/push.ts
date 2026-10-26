import { auth } from "../firebase";
import { needsIosInstall, subscriptionExpired, subscriptionKeyDiffers, vapidKey } from "./pushUtils";

async function pushRequest(action: "subscribe" | "send", subscription?: PushSubscription) {
  const user = auth.currentUser;
  if (!user) throw new Error("יש להתחבר מחדש");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ action, subscription: subscription?.toJSON() }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(result.error || "שירות ההתראות לא זמין כרגע");
    return result;
  } catch (error) {
    if (error instanceof Error && /[\u0590-\u05ff]/.test(error.message)) throw error;
    throw new Error("החיבור לשירות ההתראות לא הושלם. נסו שוב.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function enablePushNotifications() {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window))
    throw new Error("המכשיר או הדפדפן אינם תומכים בהתראות פוש");
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (needsIosInstall(navigator.userAgent, standalone))
    throw new Error("באייפון יש להוסיף את האתר למסך הבית ולפתוח אותו משם כדי לקבל התראות");
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("צריך לאשר התראות בהגדרות המכשיר");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await subscribeAndRegister(registration, await fetchPublicKey());
  } catch (error) {
    if (error instanceof Error && /[\u0590-\u05ff]/.test(error.message)) throw error;
    throw new Error("לא הצלחנו להפעיל התראות. נסו שוב מתוך האפליקציה.");
  }
}

async function fetchPublicKey(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/push", { signal: controller.signal });
    if (!response.ok) throw new Error("שירות ההתראות לא זמין כרגע");
    const publicKey = (await response.json()).publicKey;
    if (typeof publicKey !== "string") throw new Error("שירות ההתראות לא הוגדר");
    return publicKey;
  } finally {
    clearTimeout(timeout);
  }
}

/** Reuse a valid subscription, replace an expired or foreign-key one, then upsert it on the server. */
async function subscribeAndRegister(registration: ServiceWorkerRegistration, publicKey: string) {
  let subscription = await registration.pushManager.getSubscription();
  if (
    subscription &&
    (subscriptionExpired(subscription.expirationTime) ||
      subscriptionKeyDiffers(subscription.options?.applicationServerKey, publicKey))
  ) {
    await subscription.unsubscribe().catch(() => {});
    subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKey(publicKey),
  });
  await pushRequest("subscribe", subscription);
}

/**
 * Run on login. With permission granted, re-registers a missing, expired or
 * rotated subscription and refreshes the server copy. Never prompts; on iOS
 * outside the installed app it quietly does nothing.
 */
export async function syncExistingPushSubscription() {
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window) ||
      Notification.permission !== "granted") return;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (needsIosInstall(navigator.userAgent, standalone)) return;
  const registration = await navigator.serviceWorker.register("/sw.js");
  await subscribeAndRegister(registration, await fetchPublicKey());
}

export async function sendPartnerPush() {
  await pushRequest("send");
}
