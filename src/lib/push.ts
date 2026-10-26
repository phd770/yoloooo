import { auth } from "../firebase";

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

function vapidKey(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

export async function enablePushNotifications() {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window))
    throw new Error("המכשיר או הדפדפן אינם תומכים בהתראות פוש");
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (isIos && !standalone)
    throw new Error("באייפון יש להוסיף את האתר למסך הבית ולפתוח אותו משם כדי לקבל התראות");
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("צריך לאשר התראות בהגדרות המכשיר");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let publicKey: string;
  try {
    const response = await fetch("/api/push", { signal: controller.signal });
    if (!response.ok) throw new Error("שירות ההתראות לא זמין כרגע");
    publicKey = (await response.json()).publicKey;
    if (typeof publicKey !== "string") throw new Error("שירות ההתראות לא הוגדר");
  } finally {
    clearTimeout(timeout);
  }
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.getSubscription() ||
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey(publicKey),
      });
    await pushRequest("subscribe", subscription);
  } catch (error) {
    if (error instanceof Error && /[\u0590-\u05ff]/.test(error.message)) throw error;
    throw new Error("לא הצלחנו להפעיל התראות. נסו שוב מתוך האפליקציה.");
  }
}

export async function syncExistingPushSubscription() {
  if (!("serviceWorker" in navigator) || !("Notification" in window) ||
      Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await pushRequest("subscribe", subscription);
}

export async function sendPartnerPush() {
  await pushRequest("send");
}
