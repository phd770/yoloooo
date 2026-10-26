import { useEffect, useState } from "react";

export function useAutoLogout(
  userId: string | undefined,
  logout: (user: null) => Promise<void>,
) {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (!userId) {
      setLocked(false);
      return;
    }
    let expired = false;
    let deadline = Date.now() + 60_000;
    let timer: ReturnType<typeof setTimeout>;
    const lock = () => {
      if (expired) return;
      expired = true;
      clearTimeout(timer);
      setLocked(true);
      void logout(null).catch(() => {
        // Reloading also discards the in-memory identity if sign-out failed.
        window.location.reload();
      });
    };
    const check = () => {
      if (Date.now() >= deadline) lock();
      else timer = setTimeout(check, deadline - Date.now());
    };
    const activity = () => {
      if (expired) return;
      // A suspended phone can delay timers: never extend an already expired session.
      if (Date.now() >= deadline) {
        lock();
        return;
      }
      deadline = Date.now() + 60_000;
      clearTimeout(timer);
      timer = setTimeout(check, 60_000);
    };
    const visibility = () => {
      // Mobile browsers send transient hidden/pagehide events for app switching,
      // system sheets, and the back-forward cache. The idle deadline is the
      // single source of truth; only a full minute without user input signs out.
      if (Date.now() >= deadline) lock();
    };
    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "input",
      "touchstart",
      "touchmove",
      "wheel",
    ];
    events.forEach(event => window.addEventListener(event, activity, { capture: true, passive: true }));
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", visibility);
    timer = setTimeout(check, 60_000);
    visibility();
    return () => {
      clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, activity, true));
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", visibility);
    };
  }, [userId, logout]);
  return locked;
}
