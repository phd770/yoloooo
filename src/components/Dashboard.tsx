import React, { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Layout, type AppTab } from "./Layout";
import { Home } from "./Home";
const Inbox = lazy(() =>
  import("./Inbox").then((module) => ({ default: module.Inbox })),
);
const Settings = lazy(() =>
  import("./Settings").then((module) => ({ default: module.Settings })),
);
const DiscreteChat = lazy(() =>
  import("./DiscreteChat").then((module) => ({ default: module.DiscreteChat })),
);
const Vault = lazy(() =>
  import("./Vault").then((module) => ({ default: module.Vault })),
);
const Games = lazy(() =>
  import("./Games").then((module) => ({ default: module.Games })),
);
const Zimmers = lazy(() =>
  import("./Zimmers").then((module) => ({ default: module.Zimmers })),
);
import { ErrorBoundary } from "./ErrorBoundary";

type DashboardTab = AppTab;

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    try {
      if (new URLSearchParams(window.location.search).get("tab") === "chat")
        return "chat";
      const savedTab = localStorage.getItem("dateapp_active_tab");
      return savedTab &&
        ["home", "inbox", "settings", "chat", "vault", "games", "zimmers"].includes(
          savedTab,
        )
        ? (savedTab as DashboardTab)
        : "home";
    } catch {
      return "home";
    }
  });
  const activeTabRef = useRef(activeTab);
  const [gamesListRequest, setGamesListRequest] = useState(0);
  const navigate = useCallback((tab: DashboardTab) => {
    if (tab === "games" && activeTabRef.current === "games")
      setGamesListRequest((value) => value + 1);
    activeTabRef.current = tab;
    setActiveTab(tab);
  }, []);
  React.useEffect(() => {
    const openChat = (event: MessageEvent) => {
      if (event.data?.type === "OPEN_CHAT") navigate("chat");
    };
    navigator.serviceWorker?.addEventListener("message", openChat);
    return () => navigator.serviceWorker?.removeEventListener("message", openChat);
  }, [navigate]);

  React.useEffect(() => {
    try {
      localStorage.setItem("dateapp_active_tab", activeTab);
    } catch {}
  }, [activeTab]);

  return (
    <Layout activeTab={activeTab} setActiveTab={navigate}>
      <ErrorBoundary key={activeTab}>
        <Suspense
          fallback={
            <div role="status" className="empty-state">
              טוענים את המקום שלכם…
            </div>
          }
        >
          <div className="h-full min-h-0 w-full">
            {activeTab === "home" && <Home onNavigate={navigate} />}
            {activeTab === "inbox" && <Inbox />}
            {activeTab === "chat" && (
              <DiscreteChat
                onBack={() => navigate("home")}
                onNavigate={navigate}
              />
            )}
            {activeTab === "vault" && <Vault />}
            {activeTab === "settings" && <Settings />}
            {activeTab === "games" && <Games listRequest={gamesListRequest} />}
            {activeTab === "zimmers" && <Zimmers />}
          </div>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
}
