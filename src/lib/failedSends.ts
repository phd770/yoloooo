import type { ChatMessage } from "./types";

/** A chat send that was not confirmed, kept so it survives unmount and reload. */
export interface FailedSend {
  id: string;
  message: ChatMessage;
  /** Arguments for AppContext.sendMessage; undefined entries are stored as null. */
  args: unknown[];
}

export function failedSendsKey(userId: string | undefined) {
  return `dateapp_chat_failed_${userId}`;
}

export function loadFailedSends(key: string): FailedSend[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (entry) =>
          entry &&
          typeof entry.id === "string" &&
          entry.message &&
          typeof entry.message.id === "string" &&
          Array.isArray(entry.args),
      )
      .map((entry) => ({
        ...entry,
        args: entry.args.map((arg: unknown) => (arg === null ? undefined : arg)),
      }));
  } catch {
    return [];
  }
}

/** Returns false when the entry could not be persisted. */
export function saveFailedSend(key: string, entry: FailedSend): boolean {
  try {
    const others = loadFailedSends(key).filter((value) => value.id !== entry.id);
    sessionStorage.setItem(key, JSON.stringify([...others, entry]));
    return true;
  } catch {
    return false;
  }
}

export function removeFailedSend(key: string, id: string) {
  try {
    const rest = loadFailedSends(key).filter((value) => value.id !== id);
    if (rest.length) sessionStorage.setItem(key, JSON.stringify(rest));
    else sessionStorage.removeItem(key);
  } catch {}
}
