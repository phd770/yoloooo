import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Paperclip,
  X,
  Settings2,
  Check,
  CheckCheck,
  Clock,
  ArrowDown,
  ArrowRight,
  Mic,
  Square,
  MapPin,
  Eye,
  Reply,
  Pencil,
  FolderLock,
  Heart,
  BellRing,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../lib/store";
import { uploadChatMedia } from "../lib/media";
import { addUrlToVault } from "../lib/vaultStore";
import { renderTextWithLinks } from "../lib/linkify";
import type { ChatMessage } from "../lib/types";
import { sendPartnerPush } from "../lib/push";

async function waitForSend<T>(request: Promise<T>, timeoutMs = 20000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("החיבור איטי")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout!);
  }
}

function formatLastSeen(timestamp: number, now: number) {
  const elapsedMinutes = Math.max(1, Math.floor((now - timestamp) / 60000));
  if (elapsedMinutes < 60) return `לפני ${elapsedMinutes} דקות`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `לפני ${elapsedHours} שעות`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `לפני ${elapsedDays} ימים`;
}

export function DiscreteChat({
  onBack,
  onNavigate,
}: {
  onBack?: () => void;
  onNavigate?: (tab: any) => void;
}) {
  const app = useApp();
  const { currentUser, partner, chatSession, chatMessages } = app;
  const draftKey = `dateapp_chat_draft_${currentUser?.id}`;
  const [text, setText] = useState(() => {
    try {
      return sessionStorage.getItem(draftKey) || "";
    } catch {
      return "";
    }
  });
  const [sending, setSending] = useState(false);
  const [pinging, setPinging] = useState(false);
  const sendingRef = useRef(false);
  const [outbox, setOutbox] = useState<ChatMessage[]>([]);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const retryArgs = useRef<Map<string, Parameters<typeof app.sendMessage>>>(new Map());
  const pendingSendKey = `dateapp_chat_pending_${currentUser?.id}`;
  const [attachment, setAttachment] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [once, setOnce] = useState(false);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ChatMessage | null>(null);
  const [now, setNow] = useState(Date.now());
  const [atBottom, setAtBottom] = useState(true);
  const bottomRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const swipeStart = useRef<{ x: number; y: number; id: string } | null>(null);
  const viewDialog = useRef<HTMLDialogElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const [recording, setRecording] = useState(false);
  const typingAt = useRef(0);
  const hiddenAt =
    chatSession?.deletedAtByUser?.[currentUser?.id || ""] ||
    (chatSession?.isDeleted ? chatSession.deletedAt || 0 : 0);
  const messages = useMemo(() => {
    const receivedIds = new Set(chatMessages.map((message) => message.id));
    return [...chatMessages, ...outbox.filter((message) => !receivedIds.has(message.id))]
      .filter((message) =>
        !message.isDeleted &&
        message.createdAt > hiddenAt &&
        (!message.expiresAt || message.expiresAt > now),
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [chatMessages, outbox, hiddenAt, now]);
  useEffect(() => {
    const receivedIds = new Set(chatMessages.map((message) => message.id));
    receivedIds.forEach((id) => retryArgs.current.delete(id));
    setFailedIds((current) => {
      if (![...current].some((id) => receivedIds.has(id))) return current;
      return new Set([...current].filter((id) => !receivedIds.has(id)));
    });
    setOutbox((current) => current.some((message) => receivedIds.has(message.id))
      ? current.filter((message) => !receivedIds.has(message.id))
      : current);
  }, [chatMessages]);
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, text);
    } catch {}
  }, [draftKey, text]);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  const scrollDown = () => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    bottomRef.current = true;
    setAtBottom(true);
  };
  useEffect(() => {
    if (bottomRef.current) scrollDown();
  }, [messages.at(-1)?.id, messages.length]);
  useEffect(() => {
    if (document.visibilityState === "hidden" || !atBottom) return;
    const ids = messages
      .filter(
        (message) =>
          message.receiverId === currentUser?.id &&
          !message.viewedAt &&
          !message.isViewOnce &&
          !message.pending,
      )
      .map((message) => message.id);
    if (ids.length)
      void Promise.resolve(app.markMessagesAsViewed(ids)).catch(() => {});
  }, [chatMessages, atBottom, now]);
  useEffect(() => {
    if (!viewing) {
      viewDialog.current?.close();
      return;
    }
    viewDialog.current?.showModal();
    const timeout = viewing.isViewOnce
      ? setTimeout(
          () => setViewing(null),
          Math.min(60, viewing.viewDuration || 5) * 1000,
        )
      : undefined;
    return () => clearTimeout(timeout);
  }, [viewing]);
  const act = async (operation: () => Promise<unknown>, success?: string) => {
    try {
      await operation();
      if (success) toast.success(success);
    } catch {
      toast.error("הפעולה לא הושלמה. נסו שוב.");
    }
  };
  const startReply = (message: ChatMessage) => {
    setReply(message);
    setEditing(null);
    setSelected(null);
    requestAnimationFrame(() => composerInput.current?.focus());
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sendingRef.current || uploading || (!text.trim() && !attachment))
      return;
    sendingRef.current = true;
    setSending(true);
    const draftText = text;
    const draftAttachment = attachment;
    const draftReply = reply;
    const draftOnce = once;
    let optimisticId: string | null = null;
    try {
      if (editing) await app.editMessage(editing.id, text);
      else {
        const signature = JSON.stringify([text.trim(), attachment?.url, once, reply?.id]);
        let pending: { signature: string; id: string } | null = null;
        try { pending = JSON.parse(sessionStorage.getItem(pendingSendKey) || "null"); } catch {}
        if (!pending || pending.signature !== signature) {
          pending = { signature, id: `msg_${crypto.randomUUID()}` };
          try { sessionStorage.setItem(pendingSendKey, JSON.stringify(pending)); } catch {}
        }
        optimisticId = pending.id;
        setOutbox((current) => [...current.filter((message) => message.id !== pending.id), {
          id: pending.id,
          sessionId: "current",
          senderId: currentUser!.id,
          receiverId: partner!.id,
          createdAt: Date.now(),
          text: text.trim(),
          imageUrl: attachment?.type === "image" ? attachment.url : undefined,
          videoUrl: attachment?.type === "video" ? attachment.url : undefined,
          audioUrl: attachment?.type === "audio" ? attachment.url : undefined,
          isViewOnce: once,
          replyToId: reply?.id,
          replyToText: reply?.text || (reply ? "קובץ מצורף" : undefined),
          pending: true,
        }]);
        setText("");
        setAttachment(null);
        setReply(null);
        setOnce(false);
        const sendArgs: Parameters<typeof app.sendMessage> = [
          draftText,
          draftAttachment?.type === "image" ? draftAttachment.url : undefined,
          draftAttachment?.type === "video" ? draftAttachment.url : undefined,
          draftOnce,
          draftOnce ? 5 : undefined,
          draftReply?.id,
          draftReply?.text || (draftReply ? "קובץ מצורף" : undefined),
          false,
          draftAttachment?.type === "audio" ? draftAttachment.url : undefined,
          undefined,
          pending.id,
        ];
        retryArgs.current.set(pending.id, sendArgs);
        await waitForSend(app.sendMessage(...sendArgs));
        retryArgs.current.delete(pending.id);
        setOutbox((current) => current.map((message) => message.id === pending.id
          ? { ...message, pending: false }
          : message));
        try { sessionStorage.removeItem(pendingSendKey); } catch {}
      }
      if (editing) {
        setText("");
        setEditing(null);
      }
      scrollDown();
      void Promise.resolve(app.setTypingStatus(false)).catch(() => {});
    } catch {
      if (optimisticId) {
        // Keep the message visible: Firestore may still commit it once the
        // connection returns. Retrying reuses the same id, so no duplicate.
        const failedId = optimisticId;
        setFailedIds((current) => new Set(current).add(failedId));
        toast.error("ההודעה לא נשלחה עדיין. לחצו על ההודעה לניסיון חוזר.");
      } else {
        toast.error("הפעולה לא הושלמה. נסו שוב.");
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };
  const retrySend = async (id: string) => {
    const args = retryArgs.current.get(id);
    if (!args) return;
    setFailedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    try {
      await waitForSend(app.sendMessage(...args));
      retryArgs.current.delete(id);
      try { sessionStorage.removeItem(pendingSendKey); } catch {}
    } catch {
      setFailedIds((current) => new Set(current).add(id));
      toast.error("ההודעה עדיין לא נשלחה. בדקו את החיבור ונסו שוב.");
    }
  };
  const attach = async (file: Blob, name: string) => {
    setUploading(true);
    try {
      const saved = await uploadChatMedia(file, name);
      if (alive.current)
        setAttachment({ url: saved.url, type: file.type.split("/")[0], name });
    } catch (error) {
      toast.error(
        error instanceof Error && /[\u0590-\u05ff]/.test(error.message)
          ? error.message
          : "הקובץ לא עלה. נסו שוב.",
      );
    } finally {
      if (alive.current) setUploading(false);
    }
  };
  const toggleRecording = async () => {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      toast.error("הקלטה אינה נתמכת בדפדפן הזה");
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!alive.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = mediaStream;
      const mediaRecorder = new MediaRecorder(mediaStream);
      recorder.current = mediaRecorder;
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      mediaRecorder.onstop = () => {
        mediaStream.getTracks().forEach((track) => track.stop());
        if (alive.current && chunks.length)
          void attach(
            new Blob(chunks, { type: mediaRecorder.mimeType }),
            "voice-message",
          );
      };
      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast.error("לא ניתן להפעיל מיקרופון. בדקו את הרשאת ההקלטה.");
    }
  };
  const location = () => {
    if (!navigator.geolocation) {
      toast.error("המיקום אינו נתמך בדפדפן");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void act(
          () =>
            app.sendMessage(
              undefined,
              undefined,
              undefined,
              false,
              undefined,
              undefined,
              undefined,
              false,
              undefined,
              { lat: position.coords.latitude, lng: position.coords.longitude },
            ),
          "המיקום נשלח",
        );
      },
      () => toast.error("לא הצלחנו לקבל מיקום"),
      { timeout: 10000 },
    );
  };
  const openMedia = async (message: ChatMessage) => {
    if (message.isViewOnce && message.viewedAt) return;
    if (message.isViewOnce && message.receiverId === currentUser?.id) {
      try {
        await app.markMessageAsViewed(message.id);
      } catch {
        toast.error("לא ניתן לפתוח כרגע. נסו שוב.");
        return;
      }
    }
    setViewing({ ...message });
  };
  const busy = sending || uploading || recording;
  const partnerIsOnline = Boolean(
    partner?.isOnline && partner.lastSeen && now - partner.lastSeen < 90000,
  );
  return (
    <div className="chat-page" dir="rtl" onPointerDownCapture={(event) => {
      if (document.documentElement.hasAttribute("data-keyboard-open") &&
          !(event.target as HTMLElement).closest(".chat-composer"))
        composerInput.current?.blur();
    }}>
      <header className="chat-header">
        <button type="button" className="chat-back" aria-label="חזרה לבית" onClick={onBack}>
          <ArrowRight size={22} />
        </button>
        <span className="avatar chat-avatar">{partner?.name?.[0] || "♡"}</span>
        <div>
          <h1>{partner?.name || "השיחה שלנו"}</h1>
          <p>
            {partnerIsOnline
              ? "מחובר/ת עכשיו"
              : partner?.lastSeen
                ? `התחבר/ה ${formatLastSeen(partner.lastSeen, now)}`
                : "לא ידוע מתי התחבר/ה לאחרונה"}
          </p>
        </div>
        <button
          className="icon-button chat-ping"
          type="button"
          disabled={pinging}
          aria-label={`שליחת התראה ל${partner?.name || "הצד השני"}`}
          title={`שליחת התראה ל${partner?.name || "הצד השני"}`}
          onClick={() => {
            setPinging(true);
            void sendPartnerPush()
              .then(() => toast.success(`התראה נשלחה ל${partner?.name || "הצד השני"}`))
              .catch((error) => toast.error(error instanceof Error ? error.message : "ההתראה לא נשלחה"))
              .finally(() => setPinging(false));
          }}
        >
          <BellRing size={21} />
        </button>
        <button
          className="icon-button"
          aria-label="הגדרות השיחה"
          onClick={() => setSettings((value) => !value)}
        >
          <Settings2 size={21} />
        </button>
      </header>
      {settings && (
        <section className="chat-settings">
          <label>
            הודעות נעלמות{" "}
            <select
              value={chatSession?.autoExpireTimer || 0}
              onChange={(event) =>
                void act(() =>
                  app.updateAutoExpire(Number(event.target.value) || undefined),
                )
              }
            >
              <option value={0}>כבוי</option>
              <option value={3600000}>אחרי שעה</option>
              <option value={86400000}>אחרי יום</option>
            </select>
          </label>
          <button
            onClick={() => void act(app.softDeleteChat, "השיחה הוסתרה עבורך")}
          >
            הסתרת ההיסטוריה אצלי
          </button>
          <button
            onClick={() => {
              if (
                window.confirm("למחוק את כל הודעות השיחה לשניכם? הפעולה סופית.")
              )
                void act(() => app.panicDeleteChat(true), "השיחה נמחקה");
            }}
          >
            מחיקה לשנינו
          </button>
        </section>
      )}
      {!!hiddenAt && (
        <div className="chat-note">
          הודעות קודמות מוסתרות אצלך.{" "}
          <button onClick={() => void act(app.restoreChat)}>
            הצגת ההיסטוריה
          </button>
        </div>
      )}
      <div
        id="chat-scroll-container"
        className="chat-stream"
        ref={scrollRef}
        onScroll={() => {
          const element = scrollRef.current!;
          const at =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            100;
          bottomRef.current = at;
          setAtBottom(at);
        }}
      >
        {!messages.length && (
          <div className="empty-state">
            <Heart size={40} />
            <h2>כל שיחה מתחילה ברגע קטן</h2>
            <p>שלחו הודעה ל{partner?.name}.</p>
          </div>
        )}
        {messages.map((message) => {
          const own = message.senderId === currentUser?.id;
          const consumed = message.isViewOnce && message.viewedAt;
          return (
            <article
              key={message.id}
              className={`message-row ${own ? "own" : ""}`}
              onTouchStart={(event) => {
                const touch = event.touches[0];
                swipeStart.current = { x: touch.clientX, y: touch.clientY, id: message.id };
              }}
              onTouchEnd={(event) => {
                const start = swipeStart.current;
                swipeStart.current = null;
                if (!start || start.id !== message.id) return;
                const touch = event.changedTouches[0];
                if (Math.abs(touch.clientX - start.x) > 65 && Math.abs(touch.clientY - start.y) < 45)
                  startReply(message);
              }}
            >
              <div className="message-bubble">
                {message.replyToId && (
                  <div className="message-reply">
                    <Reply size={13} />
                    {message.replyToText || "קובץ מצורף"}
                  </div>
                )}
                {consumed ? (
                  <p className="muted">הודעה שנצפתה</p>
                ) : message.isViewOnce ? (
                  <button
                    className="once-button"
                    onClick={() => void openMedia(message)}
                  >
                    <Eye size={19} /> לצפייה חד־פעמית
                  </button>
                ) : (
                  <>
                    {message.text && (
                      <p className="message-text">
                        {renderTextWithLinks(message.text)}
                      </p>
                    )}
                    {message.imageUrl && (
                      <button
                        className="message-media"
                        aria-label="פתיחת תמונה"
                        onClick={() => void openMedia(message)}
                      >
                        <img
                          src={message.imageUrl}
                          alt="תמונה שנשלחה"
                          loading="lazy"
                          onLoad={() => {
                            if (bottomRef.current) scrollDown();
                          }}
                        />
                      </button>
                    )}
                    {message.videoUrl && (
                      <video
                        className="message-video"
                        src={message.videoUrl}
                        controls
                        preload="metadata"
                        playsInline
                      />
                    )}
                    {message.audioUrl && (
                      <audio
                        src={message.audioUrl}
                        controls
                        preload="metadata"
                      />
                    )}
                    {message.location && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${message.location.lat}&mlon=${message.location.lng}#map=16/${message.location.lat}/${message.location.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="message-location"
                      >
                        <MapPin size={18} /> מיקום במפה
                      </a>
                    )}
                  </>
                )}
                <div className="message-meta">
                  <button
                    aria-label="פעולות על ההודעה"
                    onClick={() =>
                      setSelected(selected === message.id ? null : message.id)
                    }
                  >
                    •••
                  </button>
                  <time>
                    {new Date(message.createdAt).toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  {message.editedAt && <span>נערכה</span>}
                  {own &&
                    (failedIds.has(message.id) ? (
                      <button
                        type="button"
                        aria-label="שליחה נכשלה, נסו שוב"
                        onClick={() => void retrySend(message.id)}
                      >
                        ⚠ לא נשלחה · נסו שוב
                      </button>
                    ) : message.pending ? (
                      <Clock size={12} aria-label="ממתינה לשליחה" />
                    ) : message.viewedAt ? (
                      <CheckCheck size={14} aria-label="נקראה" />
                    ) : (
                      <Check size={13} aria-label="נשלחה" />
                    ))}
                </div>
                {message.reactions && (
                  <div className="message-reactions">
                    {Object.entries(message.reactions).map(([id, reaction]) => (
                      <span key={id}>{reaction}</span>
                    ))}
                  </div>
                )}
                {selected === message.id && (
                  <div className="message-actions">
                    <button
                      aria-label="תגובה להודעה"
                      onClick={() => startReply(message)}
                    >
                      <Reply size={16} />
                    </button>
                    {own && message.text && !message.isViewOnce && (
                      <button
                        aria-label="עריכת הודעה"
                        onClick={() => {
                          setEditing(message);
                          setText(message.text || "");
                          setSelected(null);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    <button
                      aria-label="לב להודעה"
                      onClick={() =>
                        void act(() => app.reactToMessage(message.id, "❤️"))
                      }
                    >
                      ♡
                    </button>
                    {!message.isViewOnce &&
                      (message.imageUrl || message.videoUrl) && (
                        <button
                          aria-label="שמירה בכספת"
                          onClick={() =>
                            void act(
                              () =>
                                addUrlToVault(
                                  message.videoUrl ? "video" : "image",
                                  "זיכרון מהשיחה",
                                  message.videoUrl || message.imageUrl!,
                                ),
                              "נשמר בכספת",
                            )
                          }
                        >
                          <FolderLock size={16} />
                        </button>
                      )}
                  </div>
                )}
              </div>
              <button type="button" className="message-quick-reply" aria-label={`השב להודעה: ${message.text?.slice(0, 30) || "קובץ מצורף"}`} onClick={() => startReply(message)}>
                <Reply size={19} />
              </button>
            </article>
          );
        })}
      </div>
      {!atBottom && (
        <button className="chat-jump" onClick={scrollDown}>
          <ArrowDown size={16} /> להודעות האחרונות
        </button>
      )}
      {!!chatSession?.typingUsers?.[partner?.id || ""] &&
        now - chatSession.typingUsers[partner!.id] < 5000 && (
          <p className="typing-status">{partner?.name} מקליד/ה…</p>
        )}
      <form className="chat-composer" onSubmit={send}>
        {(reply || editing || attachment || uploading || recording) && (
          <div className="composer-context">
            <span>
              {recording
                ? "מקליטים… לחצו על עצירה לסיום"
                : uploading
                  ? "מעלים קובץ…"
                  : editing
                    ? "עריכת הודעה"
                    : reply
                      ? `תגובה: ${reply.text || "קובץ מצורף"}`
                      : attachment?.name}
            </span>
            {!busy && (
              <button
                type="button"
                aria-label="ביטול צירוף או תגובה"
                onClick={() => {
                  setReply(null);
                  setAttachment(null);
                  if (editing) setText("");
                  setEditing(null);
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div className="composer-main">
          <textarea
            ref={composerInput}
            aria-label="הודעה"
            placeholder="שליחת הודעה..."
            rows={1}
            value={text}
            disabled={Boolean(editing && sending)}
            maxLength={10000}
            onChange={(event) => {
              setText(event.target.value);
              if (Date.now() - typingAt.current > 2500) {
                typingAt.current = Date.now();
                void Promise.resolve(app.setTypingStatus(true)).catch(() => {});
              }
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            className="send-button"
            type="submit"
            disabled={busy || (!text.trim() && !attachment)}
            aria-label={sending ? "ממתין לאישור…" : "שלח"}
          >
            {sending ? <Clock size={20} /> : <Send size={20} />}
          </button>
        </div>
        <div className="composer-tools">
          <input
            ref={input}
            type="file"
            hidden
            accept="image/*,video/*,audio/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void attach(file, file.name);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="icon-button"
            aria-label="צירוף קובץ"
            disabled={busy || !!editing}
            onClick={() => input.current?.click()}
          >
            <Paperclip size={19} />
          </button>
          <button
            type="button"
            className={`icon-button ${recording ? "recording" : ""}`}
            aria-label={recording ? "עצירת הקלטה" : "הקלטת הודעה"}
            disabled={sending || uploading || !!editing}
            onClick={() => void toggleRecording()}
          >
            {recording ? <Square size={18} /> : <Mic size={19} />}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="שליחת מיקום"
            disabled={busy || !!editing}
            onClick={location}
          >
            <MapPin size={19} />
          </button>
          <label>
            <input
              type="checkbox"
              checked={once}
              disabled={busy || !!editing}
              onChange={(event) => setOnce(event.target.checked)}
            />{" "}
            צפייה חד־פעמית
          </label>
        </div>
      </form>
      <dialog
        ref={viewDialog}
        className="media-dialog"
        onCancel={() => setViewing(null)}
      >
        <div className="media-dialog-content">
          <header>
            <span>
              {viewing?.isViewOnce ? "צפייה חד־פעמית" : "קובץ מהשיחה"}
            </span>
            <button
              className="icon-button"
              aria-label="סגירה"
              onClick={() => setViewing(null)}
            >
              <X size={22} />
            </button>
          </header>
          {viewing?.imageUrl ? (
            <img src={viewing.imageUrl} alt="תמונה מהשיחה" />
          ) : viewing?.videoUrl ? (
            <video src={viewing.videoUrl} controls playsInline autoPlay />
          ) : viewing?.audioUrl ? (
            <audio src={viewing.audioUrl} controls autoPlay />
          ) : (
            <p className="p-8">{viewing?.text}</p>
          )}
        </div>
      </dialog>
    </div>
  );
}
