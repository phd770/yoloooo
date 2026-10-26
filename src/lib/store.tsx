import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { auth, ALLOWED_PROFILE_IDS, signOutFromApp, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  query,
  orderBy,
  limit,
  updateDoc,
  getDocs,
  writeBatch,
  runTransaction,
  deleteField,
} from "firebase/firestore";
import {
  User,
  Mission,
  Session,
  CustomButton,
  ChatSession,
  ChatMessage,
  PrivacyMode,
} from "./types";
import { DEFAULT_MISSIONS } from "./defaultMissions";
import { subscribeWithRecovery } from "./subscription";

interface AppContextType {
  syncError: string | null;
  retrySync: () => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => Promise<void>;
  partner: User | null;
  missions: Mission[];
  session: Session | null;
  sendMission: (mission: Omit<Mission, "id" | "createdAt">) => Promise<void>;
  updateMissionStatus: (
    missionId: string,
    status: Mission["status"],
    pointsValue?: number,
    response?: string,
    imageUrl?: string,
    unlockAt?: number,
    snoozeUntil?: number,
  ) => Promise<void>;
  revealMystery: (missionId: string) => Promise<void>;
  revertMissionCompletion: (
    missionId: string,
    pointsToSubtract: number,
  ) => Promise<void>;
  updateSessionMode: (mode: "together" | "remote") => Promise<void>;
  addCustomButton: (button: Omit<CustomButton, "id">) => Promise<void>;
  updateCustomButton: (button: CustomButton) => Promise<void>;
  deleteCustomButton: (button: CustomButton) => Promise<void>;
  redeemSpecialRequest: (
    level: number,
    pointsCost: number,
    title: string,
    shortText: string,
  ) => Promise<void>;
  redeemReward: (rewardName: string, cost: number) => Promise<void>;
  markMissionAsViewed: (missionId: string) => Promise<void>;
  resetAllMissions: (target: "boaz" | "mishel" | "all") => Promise<void>;

  // Chat Features
  chatSession: ChatSession | null;
  chatMessages: ChatMessage[];
  editMessage: (messageId: string, newText: string) => Promise<void>;
  sendMessage: (
    text?: string,
    imageUrl?: string,
    videoUrl?: string,
    isViewOnce?: boolean,
    viewDuration?: number,
    replyToId?: string,
    replyToText?: string,
    isPing?: boolean,
    audioUrl?: string,
    location?: { lat: number; lng: number; address?: string },
    clientMessageId?: string,
  ) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;
  panicDeleteChat: (forBoth: boolean) => Promise<void>;
  softDeleteChat: () => Promise<void>;
  restoreChat: () => Promise<void>;
  updatePrivacyMode: (mode: PrivacyMode) => Promise<void>;
  updateAutoExpire: (timerMs?: number) => Promise<void>;
  markMessageAsViewed: (messageId: string) => Promise<void>;
  markMessagesAsViewed: (messageIds: string[]) => Promise<void>;
  setTypingStatus: (isTyping: boolean) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const profile = (id: string): User => ({
  id,
  name: id === "boaz" ? "שירן" : "קרן",
  gender: id === "boaz" ? "male" : "female",
  points: 0,
  buttons: DEFAULT_MISSIONS,
});
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function cached<T>(key: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(`dateapp_${key}`) || "null");
    if (Array.isArray(fallback))
      return (
        Array.isArray(value)
          ? value.filter((item) => item && typeof item.id === "string")
          : fallback
      ) as T;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : fallback;
  } catch {
    return fallback;
  }
}
function cache(key: string, value: unknown) {
  try {
    localStorage.setItem(`dateapp_${key}`, JSON.stringify(value));
  } catch {
    /* Online use does not require local storage. */
  }
}
function normalizedUser(id: string, data: Partial<User>): User {
  const base = profile(id);
  // Profile IDs are stable because existing chats, games and vault access use them.
  // Always show the current names, including when an older name is stored remotely.
  const name = base.name;
  const buttons = Array.isArray(data.buttons)
    ? data.buttons.filter(
        (button, index, all) =>
          button?.id &&
          all.findIndex((other) => other?.id === button.id) === index,
      )
    : base.buttons;
  return { ...base, ...data, id, name, buttons };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<Record<string, User>>(() => {
    const saved = cached<Record<string, User>>("users", {});
    return Object.fromEntries(
      ALLOWED_PROFILE_IDS.map((id) => [
        id,
        normalizedUser(id, saved[id] || {}),
      ]),
    );
  });
  const [missions, setMissions] = useState<Mission[]>(() =>
    cached("missions", []),
  );
  const [session, setSession] = useState<Session | null>(() =>
    cached("session", null),
  );
  const [chatSession, setChatSession] = useState<ChatSession | null>(() =>
    cached("chat_session", null),
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    cached("chat_messages", []),
  );
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [attempt, setAttempt] = useState(0);
  const currentUser = currentUserId ? users[currentUserId] : null;
  const partner = currentUserId
    ? users[currentUserId === "boaz" ? "mishel" : "boaz"]
    : null;
  const retrySync = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        const id = user?.uid;
        setCurrentUserId(
          id && ALLOWED_PROFILE_IDS.includes(id as "boaz" | "mishel")
            ? id
            : null,
        );
        setErrors({});
        if (id && !ALLOWED_PROFILE_IDS.includes(id as "boaz" | "mishel"))
          void signOutFromApp();
      }),
    [],
  );

  useEffect(() => {
    if (!currentUserId) return;
    let disposed = false;
    const failed = (key: string) => {
      if (!disposed) setErrors((previous) => ({ ...previous, [key]: true }));
    };
    const ready = (key: string) => {
      if (!disposed)
        setErrors((previous) => {
          const next = { ...previous };
          delete next[key];
          return next;
        });
    };
    const listen = (
      key: string,
      reference: any,
      receive: (snapshot: any) => void,
    ) =>
      subscribeWithRecovery(
        (connected, error) =>
          onSnapshot(
            reference,
            { includeMetadataChanges: true },
            (snapshot) => {
              if (disposed) return;
              if (!snapshot.metadata?.fromCache) connected();
              receive(snapshot);
            },
            error,
          ),
        () => failed(key),
        () => ready(key),
      );
    // Retry initial documents too: a short offline start must not leave the
    // whole app permanently marked as unsynchronized.
    let initFailed = false;
    let initAttempts = 0;
    let initTimer: ReturnType<typeof setTimeout> | undefined;
    const initializeDefaults = () => {
      if (disposed) return;
      clearTimeout(initTimer);
      void runTransaction(db, async (transaction) => {
      const refs = [
        ...ALLOWED_PROFILE_IDS.map((id) => doc(db, "users", id)),
        doc(db, "sessions", "current"),
        doc(db, "chat_sessions", "current"),
      ];
      const snapshots = await Promise.all(
        refs.map((ref) => transaction.get(ref)),
      );
      const defaults = [
        profile("boaz"),
        profile("mishel"),
        {
          mode: "together",
          chemistryScore: 0,
          streak: 0,
          heatMeter: 0,
          updatedAt: Date.now(),
        },
        {
          participants: ["boaz", "mishel"],
          privacyMode: "normal",
          lastMessageAt: Date.now(),
        },
      ];
      snapshots.forEach((snapshot, index) => {
        if (!snapshot.exists())
          transaction.set(refs[index], clean(defaults[index]));
      });
      })
        .then(() => {
          initFailed = false;
          initAttempts = 0;
          ready("initialization");
        })
        .catch(() => {
          initFailed = true;
          failed("initialization");
          initTimer = setTimeout(initializeDefaults, Math.min(2000 * 2 ** initAttempts++, 60000));
        });
    };
    const retryInitialization = () => {
      if (initFailed && navigator.onLine && document.visibilityState === "visible")
        initializeDefaults();
    };
    initializeDefaults();
    window.addEventListener("online", retryInitialization);
    document.addEventListener("visibilitychange", retryInitialization);

    const stops = ALLOWED_PROFILE_IDS.map((id) =>
      listen(`user-${id}`, doc(db, "users", id), (snapshot) => {
        if (!snapshot.exists()) return;
        setUsers((previous) => {
          const next = {
            ...previous,
            [id]: normalizedUser(id, snapshot.data()),
          };
          cache("users", next);
          return next;
        });
      }),
    );
    stops.push(
      listen("session", doc(db, "sessions", "current"), (snapshot) => {
        if (snapshot.exists()) {
          const value = { ...snapshot.data(), id: snapshot.id };
          setSession(value);
          cache("session", value);
        }
      }),
    );
    stops.push(
      listen(
        "chat-session",
        doc(db, "chat_sessions", "current"),
        (snapshot) => {
          if (snapshot.exists()) {
            const value = { ...snapshot.data(), id: snapshot.id };
            setChatSession(value);
            cache("chat_session", value);
          }
        },
      ),
    );
    const readList = (snapshot: any, pending = false) => {
      const result: any[] = [];
      snapshot.forEach((item: any) =>
        result.push({
          ...item.data(),
          id: item.id,
          ...(pending ? { pending: item.metadata.hasPendingWrites } : {}),
        }),
      );
      return result;
    };
    stops.push(
      listen(
        "missions",
        query(
          collection(db, "missions"),
          orderBy("createdAt", "desc"),
          limit(500),
        ),
        (snapshot) => {
          if (snapshot.metadata?.fromCache && snapshot.empty) return;
          const value = readList(snapshot);
          setMissions(value);
          cache("missions", value);
        },
      ),
    );
    stops.push(
      listen(
        "chat-messages",
        query(
          collection(db, "chat_messages"),
          orderBy("createdAt", "desc"),
          limit(300),
        ),
        (snapshot) => {
          if (snapshot.metadata?.fromCache && snapshot.empty) return;
          const value = readList(snapshot, true);
          setChatMessages(value);
          cache("chat_messages", value);
        },
      ),
    );
    const presence = (isOnline: boolean) => {
      void updateDoc(doc(db, "users", currentUserId), {
        isOnline,
        lastSeen: Date.now(),
      }).catch(() => {});
    };
    const visibility = () => presence(document.visibilityState === "visible");
    const timer = setInterval(visibility, 60000);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      clearTimeout(initTimer);
      window.removeEventListener("online", retryInitialization);
      document.removeEventListener("visibilitychange", retryInitialization);
      stops.forEach((stop) => stop());
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [currentUserId, attempt]);

  const handleSetCurrentUser = useCallback(async (user: User | null) => {
    if (user) {
      // Compatibility for profile edits; identity may only come from Firebase Auth.
      setUsers((previous) =>
        previous[user.id]
          ? {
              ...previous,
              [user.id]: normalizedUser(user.id, {
                ...previous[user.id],
                ...user,
              }),
            }
          : previous,
      );
      return;
    }
    const signingOut = signOutFromApp();
    setCurrentUserId(null);
    setMissions([]);
    setChatMessages([]);
    setChatSession(null);
    setSession(null);
    for (const key of [
      "current_user_id",
      "chat_messages",
      "chat_session",
      "local_vault",
      "missions",
      "session",
    ]) {
      try {
        localStorage.removeItem(`dateapp_${key}`);
      } catch {}
    }
    await signingOut;
  }, []);
  const requireUser = () => {
    if (!currentUserId || !currentUser || !partner)
      throw new Error("יש להתחבר מחדש");
    if (!navigator.onLine)
      throw new Error("אין חיבור לאינטרנט. נסו שוב כשהחיבור חוזר.");
    return currentUserId;
  };
  const sendMission: AppContextType["sendMission"] = async (mission) => {
    const sender = requireUser();
    const id = crypto.randomUUID();
    const female = partner.gender === "female";
    await setDoc(
      doc(db, "missions", id),
      clean({
        ...mission,
        id,
        sender,
        receiver: partner.id,
        createdAt: Date.now(),
        shortText:
          (female ? mission.femaleShortText : mission.maleShortText) ||
          mission.shortText,
        fullText:
          (female ? mission.femaleFullText : mission.maleFullText) ||
          mission.fullText,
      }),
    );
  };
  const updateMissionStatus = async (
    missionId: string,
    status: Mission["status"],
    pointsValue = 0,
    response?: string,
    imageUrl?: string,
    unlockAt?: number,
    snoozeUntil?: number,
  ) => {
    if (!currentUserId) throw new Error("יש להתחבר מחדש");
    const now = Date.now();
    await runTransaction(db, async (transaction) => {
      const missionRef = doc(db, "missions", missionId);
      const userRef = doc(db, "users", currentUserId);
      const sessionRef = doc(db, "sessions", "current");
      const [missionSnap, userSnap, sessionSnap] = await Promise.all([
        transaction.get(missionRef),
        transaction.get(userRef),
        transaction.get(sessionRef),
      ]);
      if (!missionSnap.exists() || !userSnap.exists())
        throw new Error("המשימה או הפרופיל אינם זמינים");
      const previous = missionSnap.data() as Mission;
      const user = userSnap.data() as User;
      const updateData: Record<string, unknown> = { status };
      if (response !== undefined) updateData.response = response;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (unlockAt !== undefined) updateData.unlockAt = unlockAt;
      if (snoozeUntil !== undefined) updateData.snoozeUntil = snoozeUntil;
      // Replayed completion/expiry events must not award or deduct points twice.
      const newlyCompleted =
        status === "completed" && previous.status !== "completed";
      const newlyPenalized =
        status === "rejected" &&
        previous.status !== "rejected" &&
        pointsValue < 0;
      if (newlyCompleted) updateData.completedAt = now;
      transaction.update(missionRef, updateData);
      if (newlyCompleted || newlyPenalized) {
        const points = Math.max(
          0,
          (user.points || 0) + (newlyCompleted ? pointsValue + 5 : pointsValue),
        );
        const tier = [0, 65, 130, 250, 400].filter(
          (threshold) => points >= threshold,
        ).length;
        transaction.update(userRef, {
          points,
          highestTierReached: Math.max(user.highestTierReached || 1, tier),
        });
        if (sessionSnap.exists()) {
          const shared = sessionSnap.data() as Session;
          transaction.update(sessionRef, {
            chemistryScore: Math.max(
              0,
              shared.chemistryScore + (newlyCompleted ? 10 : -5),
            ),
            streak: shared.streak + (newlyCompleted ? 1 : 0),
            updatedAt: now,
          });
        }
        if (newlyCompleted && tier > (user.highestTierReached || 1)) {
          const id = `sys_${missionId}_${tier}`;
          transaction.set(doc(db, "missions", id), {
            id,
            sender: "system",
            receiver: currentUserId === "boaz" ? "mishel" : "boaz",
            title: `רמה ${tier} נפתחה! 🎉`,
            shortText: `${user.name} הגיע/ה לרמה ${tier}.`,
            status: "sent",
            createdAt: now,
            isSpecialRequest: false,
            tier,
          });
        }
      }
    });
  };

  const revertMissionCompletion = async (
    missionId: string,
    pointsToSubtract: number,
  ) => {
    if (!currentUserId) throw new Error("יש להתחבר מחדש");
    await runTransaction(db, async (transaction) => {
      const missionRef = doc(db, "missions", missionId);
      const userRef = doc(db, "users", currentUserId);
      const sessionRef = doc(db, "sessions", "current");
      const [missionSnap, userSnap, sharedSnap] = await Promise.all([
        transaction.get(missionRef),
        transaction.get(userRef),
        transaction.get(sessionRef),
      ]);
      if (!missionSnap.exists() || !userSnap.exists())
        throw new Error("המשימה או הפרופיל אינם זמינים");
      if (missionSnap.data().status !== "completed") return;
      transaction.update(missionRef, {
        status: "opened",
        completedAt: deleteField(),
      });
      transaction.update(userRef, {
        points: Math.max(
          0,
          (userSnap.data().points || 0) - pointsToSubtract - 5,
        ),
      });
      if (sharedSnap.exists())
        transaction.update(sessionRef, {
          chemistryScore: Math.max(
            0,
            (sharedSnap.data().chemistryScore || 0) - 10,
          ),
          streak: Math.max(0, (sharedSnap.data().streak || 0) - 1),
          updatedAt: Date.now(),
        });
    });
  };

  const revealMystery = async (id: string) => {
    requireUser();
    await updateDoc(doc(db, "missions", id), { isMysteryRevealed: true });
  };
  const updateSessionMode = async (mode: "together" | "remote") => {
    requireUser();
    await updateDoc(doc(db, "sessions", "current"), {
      mode,
      updatedAt: Date.now(),
    });
  };
  const changeButtons = async (
    change: (buttons: CustomButton[]) => CustomButton[],
  ) => {
    const id = requireUser();
    await runTransaction(db, async (transaction) => {
      const ref = doc(db, "users", id);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error("הפרופיל אינו זמין");
      const buttons = snapshot.data().buttons;
      transaction.update(ref, {
        buttons: clean(change(Array.isArray(buttons) ? buttons : [])),
      });
    });
  };
  const addCustomButton = (button: Omit<CustomButton, "id">) =>
    changeButtons((buttons) => [
      ...buttons,
      { ...button, id: crypto.randomUUID() },
    ]);
  const updateCustomButton = (button: CustomButton) =>
    changeButtons((buttons) =>
      buttons.map((value) => (value.id === button.id ? button : value)),
    );
  const deleteCustomButton = (button: CustomButton) =>
    changeButtons((buttons) =>
      buttons.filter((value) => value.id !== button.id),
    );
  const redeem = async (
    cost: number,
    mission: Partial<Mission>,
    prefix: string,
  ) => {
    const uid = requireUser();
    if (!Number.isFinite(cost) || cost < 0) throw new Error("עלות לא תקינה");
    const id = `${prefix}_${crypto.randomUUID()}`;
    await runTransaction(db, async (transaction) => {
      const ref = doc(db, "users", uid);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists() || (snapshot.data().points || 0) < cost)
        throw new Error("אין מספיק נקודות");
      transaction.update(ref, { points: (snapshot.data().points || 0) - cost });
      transaction.set(
        doc(db, "missions", id),
        clean({
          id,
          sender: uid,
          receiver: partner.id,
          status: "sent",
          createdAt: Date.now(),
          pointsValue: 0,
          ...mission,
        }),
      );
    });
  };
  const redeemSpecialRequest = (
    level: number,
    cost: number,
    title: string,
    shortText: string,
  ) =>
    redeem(
      cost,
      { title, shortText, isSpecialRequest: true, specialRequestLevel: level },
      "spec",
    );
  const redeemReward = (name: string, cost: number) =>
    redeem(
      cost,
      {
        sender: "system",
        title: "פרס מומש",
        shortText: `${currentUser?.name}: ${name}`,
        isSpecialRequest: false,
      },
      "reward",
    );
  const markMissionAsViewed = async (id: string) => {
    requireUser();
    await runTransaction(db, async (transaction) => {
      const ref = doc(db, "missions", id);
      const snapshot = await transaction.get(ref);
      if (snapshot.exists())
        transaction.update(ref, {
          isViewed: true,
          ...(snapshot.data().isViewOnce ? { imageUrl: "" } : {}),
        });
    });
  };
  const editMessage = async (id: string, text: string) => {
    const uid = requireUser();
    if (!text.trim()) throw new Error("ההודעה ריקה");
    const message = chatMessages.find((value) => value.id === id);
    if (!message || message.senderId !== uid)
      throw new Error("אפשר לערוך רק הודעות שלך");
    await updateDoc(doc(db, "chat_messages", id), {
      text: text.trim(),
      editedAt: Date.now(),
    });
  };
  const sendMessage: AppContextType["sendMessage"] = async (
    text,
    imageUrl,
    videoUrl,
    isViewOnce,
    viewDuration,
    replyToId,
    replyToText,
    isPing,
    audioUrl,
    location,
    clientMessageId,
  ) => {
    const uid = requireUser();
    if (
      !text?.trim() &&
      !imageUrl &&
      !videoUrl &&
      !audioUrl &&
      !location &&
      !isPing
    )
      throw new Error("ההודעה ריקה");
    const id = clientMessageId || `msg_${crypto.randomUUID()}`;
    const now = Date.now();
    const data = clean({
      id,
      sessionId: "current",
      senderId: uid,
      receiverId: partner.id,
      createdAt: now,
      text: text?.trim(),
      imageUrl,
      videoUrl,
      audioUrl,
      location,
      isViewOnce,
      viewDuration,
      replyToId,
      replyToText,
      isPing,
      mediaType: audioUrl
        ? "audio"
        : videoUrl
          ? "video"
          : imageUrl
            ? "image"
            : undefined,
      expiresAt: chatSession?.autoExpireTimer
        ? now + chatSession.autoExpireTimer
        : undefined,
    });
    const batch = writeBatch(db);
    batch.set(doc(db, "chat_messages", id), data);
    batch.set(
      doc(db, "chat_sessions", "current"),
      {
        participants: ["boaz", "mishel"],
        privacyMode: chatSession?.privacyMode || "normal",
        lastMessageAt: now,
        isDeleted: false,
        deletedBy: null,
        deletedAt: null,
        deletedAtByUser: { [uid]: deleteField() },
      },
      { merge: true },
    );
    await batch.commit();
  };
  const setTypingStatus = async (typing: boolean) => {
    if (!currentUserId || !navigator.onLine) return;
    await updateDoc(doc(db, "chat_sessions", "current"), {
      [`typingUsers.${currentUserId}`]: typing ? Date.now() : 0,
    }).catch(() => {});
  };
  const reactToMessage = async (id: string, emoji: string) => {
    const uid = requireUser();
    const message = chatMessages.find((value) => value.id === id);
    if (!message) throw new Error("ההודעה אינה זמינה");
    await updateDoc(doc(db, "chat_messages", id), {
      [`reactions.${uid}`]:
        message.reactions?.[uid] === emoji ? deleteField() : emoji,
    });
  };
  const softDeleteChat = async () => {
    const uid = requireUser();
    await setDoc(
      doc(db, "chat_sessions", "current"),
      { deletedAtByUser: { [uid]: Date.now() } },
      { merge: true },
    );
  };
  const restoreChat = async () => {
    const uid = requireUser();
    await setDoc(
      doc(db, "chat_sessions", "current"),
      {
        isDeleted: false,
        deletedBy: null,
        deletedAt: null,
        deletedAtByUser: { [uid]: deleteField() },
      },
      { merge: true },
    );
  };
  const removeDocs = async (docs: { ref: any }[]) => {
    for (let offset = 0; offset < docs.length; offset += 450) {
      const batch = writeBatch(db);
      docs
        .slice(offset, offset + 450)
        .forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  };
  const panicDeleteChat = async (forBoth: boolean) => {
    requireUser();
    if (!forBoth) return softDeleteChat();
    await removeDocs((await getDocs(collection(db, "chat_messages"))).docs);
    await setDoc(
      doc(db, "chat_sessions", "current"),
      {
        lastMessageAt: Date.now(),
        isDeleted: false,
        deletedBy: null,
        deletedAt: null,
      },
      { merge: true },
    );
  };
  const updatePrivacyMode = async (mode: PrivacyMode) => {
    requireUser();
    await updateDoc(doc(db, "chat_sessions", "current"), { privacyMode: mode });
  };
  const updateAutoExpire = async (timer?: number) => {
    requireUser();
    await updateDoc(doc(db, "chat_sessions", "current"), {
      autoExpireTimer: timer || null,
    });
  };
  const markMessagesAsViewed = async (ids: string[]) => {
    if (!currentUserId || !ids.length) return;
    const allowed = ids.filter((id) =>
      chatMessages.some(
        (message) =>
          message.id === id &&
          message.receiverId === currentUserId &&
          !message.isViewOnce &&
          !message.viewedAt,
      ),
    );
    if (!allowed.length) return;
    for (let offset = 0; offset < allowed.length; offset += 450) {
      const batch = writeBatch(db);
      allowed.slice(offset, offset + 450).forEach((id) =>
        batch.update(doc(db, "chat_messages", id), { viewedAt: Date.now() }),
      );
      await batch.commit();
    }
  };
  const markMessageAsViewed = async (id: string) => {
    requireUser();
    await runTransaction(db, async (transaction) => {
      const ref = doc(db, "chat_messages", id);
      const snapshot = await transaction.get(ref);
      if (
        !snapshot.exists() ||
        snapshot.data().receiverId !== currentUserId ||
        snapshot.data().viewedAt
      )
        return;
      transaction.update(ref, {
        viewedAt: Date.now(),
        ...(snapshot.data().isViewOnce
          ? { imageUrl: "", videoUrl: "", audioUrl: "", text: "הודעה שנצפתה" }
          : {}),
      });
    });
  };
  const resetAllMissions = async (target: "boaz" | "mishel" | "all") => {
    requireUser();
    const snapshot = await getDocs(collection(db, "missions"));
    await removeDocs(
      snapshot.docs.filter(
        (item) =>
          target === "all" ||
          item.data().sender === target ||
          item.data().receiver === target,
      ),
    );
    const batch = writeBatch(db);
    (target === "all" ? ALLOWED_PROFILE_IDS : [target]).forEach((id) =>
      batch.update(doc(db, "users", id), { points: 0, highestTierReached: 1 }),
    );
    if (target === "all")
      batch.update(doc(db, "sessions", "current"), {
        chemistryScore: 0,
        streak: 0,
        updatedAt: Date.now(),
      });
    await batch.commit();
  };
  return (
    <AppContext.Provider
      value={{
        currentUser,
        partner,
        setCurrentUser: handleSetCurrentUser,
        missions,
        session,
        chatSession,
        chatMessages,
        syncError: Object.keys(errors).length
          ? "הסנכרון לא הושלם. בדקו את החיבור ונסו שוב."
          : null,
        retrySync,
        sendMission,
        updateMissionStatus,
        revealMystery,
        revertMissionCompletion,
        updateSessionMode,
        addCustomButton,
        updateCustomButton,
        deleteCustomButton,
        redeemSpecialRequest,
        redeemReward,
        markMissionAsViewed,
        resetAllMissions,
        editMessage,
        sendMessage,
        reactToMessage,
        panicDeleteChat,
        softDeleteChat,
        restoreChat,
        updatePrivacyMode,
        updateAutoExpire,
        markMessageAsViewed,
        markMessagesAsViewed,
        setTypingStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp requires AppProvider");
  return value;
}
