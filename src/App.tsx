/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { AppProvider, useApp } from "./lib/store";
import { UserSelect } from "./components/UserSelect";
import { Dashboard } from "./components/Dashboard";
import { Toaster } from "sonner";
import { waitForAuthState } from "./firebase";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAutoLogout } from "./lib/useAutoLogout";
import { useVisualViewport } from "./lib/useVisualViewport";

function MainApp() {
  useVisualViewport();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const { currentUser, syncError, retrySync, setCurrentUser } = useApp();
  const locked = useAutoLogout(currentUser?.id, setCurrentUser);

  return (
    <div className="app-viewport fixed left-0 top-0 w-full bg-background text-foreground selection:bg-primary/30 flex flex-col overflow-hidden">
      {!online && (
        <div
          role="status"
          dir="rtl"
          className="shrink-0 bg-amber-50 p-2 text-center text-sm"
        >
          אין חיבור לאינטרנט. הטיוטה נשמרת; נסה לשלוח שוב כשהחיבור חוזר.
        </div>
      )}
      {syncError && (
        <div
          role="alert"
          dir="rtl"
          className="shrink-0 bg-amber-50 p-2 text-center text-sm text-amber-900"
        >
          {syncError}{" "}
          <button className="underline" onClick={retrySync}>
            נסה להתחבר מחדש
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {!currentUser || locked ? <UserSelect /> : <Dashboard />}
      </div>
      <Toaster position="top-center" richColors theme="light" />
    </div>
  );
}

function ConnectedApp() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    const timeout = setTimeout(() => {
      if (!cancelled) setStatus("error");
    }, 15000);
    waitForAuthState()
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [attempt]);

  // Finish clearing any previous identity before mounting data subscriptions.
  if (status !== "ready")
    return (
      <div
        dir="rtl"
        className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center"
        role="status"
      >
        <p>
          {status === "loading"
            ? "טוען…"
            : "לא הצלחנו לטעון את האתר. בדוק את החיבור ונסה שוב."}
        </p>
        {status === "error" && (
          <button
            className="rounded-xl bg-primary px-6 py-3 text-white"
            onClick={() => setAttempt((value) => value + 1)}
          >
            נסה שוב
          </button>
        )}
      </div>
    );
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ConnectedApp />
    </ErrorBoundary>
  );
}
