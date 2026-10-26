import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { doc } from "firebase/firestore";
import {
  Home,
  Bell,
  Settings,
  MessageCircle,
  FolderLock,
  Gamepad2,
  Heart,
} from "lucide-react";
import { useApp } from "../lib/store";
import { db } from "../firebase";
import { observeDocument } from "../lib/realtime";
import { getGameTurn, isUsersTurn } from "../lib/gameTurnNotifications";
import { sendNotification } from "../lib/notifications";
import { syncExistingPushSubscription } from "../lib/push";
export type AppTab = "home" | "inbox" | "settings" | "chat" | "vault" | "games";
const WaitingGamesContext = createContext<readonly string[]>([]);
export const useWaitingGames = () => useContext(WaitingGamesContext);
const tabs = [
  { id: "home", label: "בית", icon: Home },
  { id: "chat", label: "שיחה", icon: MessageCircle },
  { id: "inbox", label: "משימות", icon: Bell },
  { id: "vault", label: "כספת", icon: FolderLock },
  { id: "games", label: "משחקים", icon: Gamepad2 },
  { id: "settings", label: "פרופיל", icon: Settings },
] as const;
export function Layout({
  children,
  activeTab,
  setActiveTab,
}: {
  children: React.ReactNode;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}) {
  const { currentUser, partner, missions, chatMessages, chatSession } = useApp();
  const previousMessage = useRef<string | null>(null);
  const previousGameTurns = useRef<Record<string, string | null>>({});
  const [waitingGames, setWaitingGames] = useState<string[]>([]);
  useEffect(() => {
    if (currentUser?.id) void syncExistingPushSubscription().catch(() => {});
  }, [currentUser?.id]);
  useEffect(() => {
    const message = chatMessages[0];
    if (!message) return;
    const previous = previousMessage.current;
    previousMessage.current = message.id;
    if (
      !previous ||
      previous === message.id ||
      message.receiverId !== currentUser?.id ||
      message.viewedAt ||
      message.isDeleted ||
      (message.expiresAt && message.expiresAt <= Date.now())
    )
      return;
    if (activeTab !== "chat")
      toast("יש לך הודעה חדשה", {
        action: { label: "לשיחה", onClick: () => setActiveTab("chat") },
      });
    if (
      document.visibilityState === "hidden" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("my baby land", {
          body: "מחכה לך הודעה חדשה",
          tag: "new-message",
        });
      } catch {}
    }
  }, [chatMessages, currentUser?.id, activeTab, setActiveTab]);
  useEffect(() => {
    if (!currentUser?.id || !partner?.id) return;

    const games = [
      ["tictactoe", "tictactoe_"],
      ["connect4", "connect4_"],
      ["dotsandboxes", "dotsandboxes_"],
      ["backgammon", "backgammon_"],
    ] as const;
    const gameKey = [currentUser.id, partner.id].sort().join("_");
    const unsubscribers = games.flatMap(([gameId, prefix]) => {
      try {
        return [
          observeDocument(doc(db, "games", `${prefix}${gameKey}`), (snapshot) => {
            if (!snapshot.exists()) return;
            const turn = getGameTurn(gameId, snapshot.data());
            const previousPlayer = previousGameTurns.current[gameId];
            previousGameTurns.current[gameId] = turn.playerId;
            const myTurn = isUsersTurn(turn, currentUser.id);
            setWaitingGames((current) => myTurn
              ? current.includes(gameId) ? current : [...current, gameId]
              : current.filter((id) => id !== gameId));
            if (
              !myTurn ||
              previousPlayer === undefined ||
              previousPlayer === currentUser.id
            )
              return;

            toast(`התור שלך ב${turn.title}`, {
              description: "המשחק מחכה לך",
              action: {
                label: "למשחק",
                onClick: () => setActiveTab("games"),
              },
              duration: 5000,
            });
            if (document.visibilityState === "hidden") {
              sendNotification(`התור שלך ב${turn.title}`, {
                body: "המשחק מחכה לך",
                tag: `game-turn-${gameId}`,
              });
            }
          }),
        ];
      } catch {
        return [];
      }
    });
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [currentUser?.id, partner?.id, setActiveTab]);
  useEffect(() => {
    return () => {
      previousGameTurns.current = {};
    };
  }, [currentUser?.id, partner?.id]);
  const hiddenAt = chatSession?.deletedAtByUser?.[currentUser?.id || ""] || 0;
  const counts: Partial<Record<AppTab, number>> = {
    chat: chatMessages.filter(
      (message) =>
        message.receiverId === currentUser?.id &&
        !message.viewedAt &&
        !message.isDeleted &&
        message.createdAt > hiddenAt &&
        (!message.expiresAt || message.expiresAt > Date.now()),
    ).length,
    inbox: missions.filter(
      (mission) =>
        mission.receiver === currentUser?.id &&
        ["sent", "opened", "pending"].includes(mission.status),
    ).length,
    games: waitingGames.length,
  };
  return (
    <div className="app-shell" dir="rtl">
      <aside className="app-sidebar">
        <a
          className="app-wordmark"
          href="#home"
          onClick={(event) => {
            event.preventDefault();
            setActiveTab("home");
          }}
        >
          <Heart size={25} />
          <span dir="ltr">my baby land</span>
        </a>
        <p className="sidebar-caption">המקום הקטן של שניכם</p>
        <nav className="app-navigation" aria-label="ניווט ראשי">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? "page" : undefined}
              className={`nav-item nav-item-${id} ${activeTab === id ? "selected" : ""}`}
            >
              <span className="nav-icon">
                <Icon size={21} />
                {!!counts[id] && (
                  <span className="nav-badge" aria-label={id === "games" ? `${counts[id]} משחקים שמחכים לתורך` : `${counts[id]} ממתינים`}>
                    {Math.min(counts[id]!, 99)}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-person">
          <span className="avatar">{currentUser?.name?.[0]}</span>
          <span>
            <strong>{currentUser?.name}</strong>
            <small>{currentUser?.points || 0} נקודות</small>
          </span>
        </div>
      </aside>
      <main className="app-content" id="main-content">
        <WaitingGamesContext.Provider value={waitingGames}>
          {children}
        </WaitingGamesContext.Provider>
      </main>
    </div>
  );
}
