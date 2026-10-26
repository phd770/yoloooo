import { auth } from "../firebase";
export async function verifyVaultCode(
  step: 1 | 2,
  pin: string,
  challenge?: string,
): Promise<{ challenge?: string; unlocked?: boolean }> {
  const user = auth.currentUser;
  if (!user) throw new Error("יש להתחבר מחדש");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const token = await user.getIdToken();
    const response = await fetch("/api/vault-access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ step, pin, challenge }),
      signal: controller.signal,
    });
    if (response.status === 409) throw new Error("יש להתחיל שוב מהקוד הראשון");
    if (response.status === 403) throw new Error("הקוד שגוי. נסו שוב.");
    if (response.status === 429)
      throw new Error("בוצעו יותר מדי ניסיונות. נסו בעוד 15 דקות.");
    if (response.status === 401) throw new Error("יש להתחבר מחדש");
    if (!response.ok) throw new Error("לא ניתן לפתוח את הכספת כרגע. נסו שוב.");
    const data = await response.json();
    if (
      step === 1 ? typeof data.challenge !== "string" : data.unlocked !== true
    )
      throw new Error("לא התקבל אישור לפתיחה");
    return data;
  } catch (error) {
    if (error instanceof Error && /[\u0590-\u05ff]/.test(error.message))
      throw error;
    throw new Error("החיבור לא הושלם. נסו שוב.");
  } finally {
    clearTimeout(timeout);
  }
}
