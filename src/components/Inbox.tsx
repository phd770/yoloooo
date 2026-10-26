import React, { useEffect, useRef, useState } from "react";
import { Check, Clock, Plus, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../lib/store";
import type { Mission } from "../lib/types";
import { uploadChatMedia } from "../lib/media";
const labels: Record<Mission["status"], string> = {
  sent: "חדשה",
  pending: "ממתינה",
  opened: "נפתחה",
  completed: "הושלמה",
  rejected: "נדחתה",
  saved_for_later: "לאחר כך",
  locked: "נעולה",
};
export function Inbox() {
  const app = useApp();
  const [tab, setTab] = useState<"received" | "sent" | "history">("received");
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const photoDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!preview) {
      photoDialog.current?.close();
      return;
    }
    photoDialog.current?.showModal();
    const timer = setTimeout(() => setPreview(null), 5000);
    return () => clearTimeout(timer);
  }, [preview]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const shown = app.missions.filter((mission) =>
    tab === "sent"
      ? mission.sender === app.currentUser?.id
      : mission.receiver === app.currentUser?.id &&
        (tab === "history"
          ? ["completed", "rejected"].includes(mission.status)
          : !["completed", "rejected"].includes(mission.status)),
  );
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      busy ||
      !title.trim() ||
      !description.trim() ||
      !app.partner ||
      !app.currentUser
    )
      return;
    setBusy("new");
    try {
      await app.sendMission({
        sender: app.currentUser.id,
        receiver: app.partner.id,
        title: title.trim(),
        shortText: description.trim(),
        status: "sent",
        pointsValue: points,
      });
      setComposing(false);
      setTitle("");
      setDescription("");
      toast.success("המשימה נשלחה");
      setTab("sent");
    } catch {
      toast.error("המשימה לא נשלחה. התוכן נשמר ואפשר לנסות שוב.");
    } finally {
      setBusy(null);
    }
  };
  const update = async (mission: Mission, status: Mission["status"]) => {
    if (busy) return;
    setBusy(mission.id);
    try {
      if (status === "completed" && mission.isViewOnce && !photo) {
        toast.error("יש לצרף תמונה להשלמת המשימה");
        return;
      }
      const imageUrl =
        photo && status === "completed"
          ? (await uploadChatMedia(photo, photo.name)).url
          : undefined;
      await app.updateMissionStatus(
        mission.id,
        status,
        status === "completed" ? mission.pointsValue || 0 : 0,
        response || undefined,
        imageUrl,
        undefined,
        status === "saved_for_later" ? Date.now() + 3600000 : undefined,
      );
      setOpened(null);
      setResponse("");
      setPhoto(null);
      toast.success(
        status === "completed"
          ? "המשימה הושלמה והנקודות נשמרו"
          : "המשימה עודכנה",
      );
    } catch {
      toast.error("העדכון לא נשמר. נסו שוב.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">משהו קטן שעושה טוב</p>
          <h1>המשימות שלנו</h1>
          <p>מפתיעים, משלימים וצוברים רגעים ביחד.</p>
        </div>
        <span className="feature-icon peach">
          <Sparkles size={25} />
        </span>
      </header>
      <div className="toolbar">
        <div className="segmented">
          {(
            [
              { id: "received", text: "בשבילי" },
              { id: "sent", text: "שלחתי" },
              { id: "history", text: "היסטוריה" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
            >
              {item.text}
            </button>
          ))}
        </div>
        <button
          className="button button-primary"
          onClick={() => setComposing((value) => !value)}
        >
          <Plus size={17} /> משימה חדשה
        </button>
      </div>
      {composing && (
        <form className="panel" onSubmit={send}>
          <h2>משימה ל{app.partner?.name}</h2>
          {!!app.currentUser?.buttons?.length && (
            <label className="field">
              אפשר להתחיל מרעיון קיים
              <select
                defaultValue=""
                onChange={(event) => {
                  const button = app.currentUser?.buttons?.find(
                    (item) => item.id === event.target.value,
                  );
                  if (button) {
                    setTitle(button.label);
                    setDescription(
                      (app.partner?.gender === "female"
                        ? button.femaleActionText
                        : button.maleActionText) || button.actionText,
                    );
                    setPoints(button.pointsValue);
                  }
                }}
              >
                <option value="">בחירת רעיון</option>
                {app.currentUser.buttons.map((button) => (
                  <option key={button.id} value={button.id}>
                    {button.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            כותרת
            <input
              required
              maxLength={100}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!!busy}
            />
          </label>
          <label className="field">
            מה עושים?
            <textarea
              required
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!!busy}
            />
          </label>
          <label className="field">
            נקודות
            <input
              type="number"
              min={0}
              max={100}
              required
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
              disabled={!!busy}
            />
          </label>
          <div className="action-row">
            <button className="button button-primary" disabled={!!busy}>
              <Send size={17} />
              {busy === "new" ? "שולחים…" : "שליחת משימה"}
            </button>
            <button
              type="button"
              className="button button-light"
              disabled={!!busy}
              onClick={() => setComposing(false)}
            >
              סגירה
            </button>
          </div>
        </form>
      )}
      {!shown.length && (
        <div className="empty-state">
          <Sparkles size={40} />
          <h2>אין כאן משימות כרגע</h2>
          <p>אפשר לשלוח משימה חדשה ולהתחיל משהו טוב.</p>
        </div>
      )}
      {shown.map((mission) => {
        const delayed =
          Math.max(mission.unlockAt || 0, mission.snoozeUntil || 0) > now;
        const active = !["completed", "rejected"].includes(mission.status);
        const mine = mission.receiver === app.currentUser?.id;
        return (
          <article className="panel mission-card" key={mission.id}>
            <div className="mission-top">
              <span className="pill">
                {labels[mission.status] || mission.status}
              </span>
              <span className="muted">{mission.pointsValue || 0} נקודות</span>
            </div>
            <h2>{mission.title}</h2>
            <p>
              {mission.isMystery && !mission.isMysteryRevealed
                ? "משימת הפתעה מחכה לך."
                : mission.shortText}
            </p>
            {delayed && (
              <p className="notice">
                זמינה ב־
                {new Date(
                  Math.max(mission.unlockAt || 0, mission.snoozeUntil || 0),
                ).toLocaleString("he-IL")}
              </p>
            )}
            {mission.response && (
              <div className="mission-response">התגובה: {mission.response}</div>
            )}
            {mission.imageUrl && !mission.isViewOnce && (
              <img
                className="mission-photo"
                src={mission.imageUrl}
                alt="תמונה שצורפה למשימה"
              />
            )}
            {mission.imageUrl &&
              mission.isViewOnce &&
              !mission.isViewed &&
              !mine && (
                <button
                  className="button button-light mt-3"
                  onClick={async () => {
                    const url = mission.imageUrl!;
                    try {
                      await app.markMissionAsViewed(mission.id);
                      setPreview(url);
                    } catch {
                      toast.error("לא ניתן לפתוח את התמונה כרגע");
                    }
                  }}
                >
                  פתיחת תמונה חד־פעמית
                </button>
              )}
            {mine && active && !delayed && (
              <button
                className="button button-light mt-4"
                onClick={async () => {
                  if (mission.isMystery && !mission.isMysteryRevealed) {
                    try {
                      await app.revealMystery(mission.id);
                    } catch {
                      toast.error("לא ניתן לפתוח כרגע");
                      return;
                    }
                  }
                  setOpened(opened === mission.id ? null : mission.id);
                  setResponse("");
                  setPhoto(null);
                }}
              >
                לפרטי המשימה
              </button>
            )}
            {opened === mission.id && mine && active && !delayed && (
              <div className="mission-details">
                <p>{mission.fullText}</p>
                <label className="field">
                  תגובה אישית
                  <textarea
                    value={response}
                    maxLength={1000}
                    onChange={(event) => setResponse(event.target.value)}
                    disabled={!!busy}
                  />
                </label>
                <label className="field">
                  תמונה {mission.isViewOnce ? "(נדרשת)" : "(לבחירתך)"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!!busy}
                    onChange={(event) =>
                      setPhoto(event.target.files?.[0] || null)
                    }
                  />
                </label>
                <div className="action-row">
                  <button
                    className="button button-primary"
                    disabled={!!busy}
                    onClick={() => void update(mission, "completed")}
                  >
                    <Check size={16} /> השלמתי
                  </button>
                  <button
                    className="button button-light"
                    disabled={!!busy}
                    onClick={() => void update(mission, "saved_for_later")}
                  >
                    <Clock size={16} /> בעוד שעה
                  </button>
                  <button
                    className="button button-light"
                    disabled={!!busy}
                    onClick={() => void update(mission, "rejected")}
                  >
                    <X size={16} /> לא הפעם
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
      <dialog
        ref={photoDialog}
        className="media-dialog"
        onCancel={() => setPreview(null)}
      >
        <div className="media-dialog-content">
          <header>
            <span>צפייה חד־פעמית</span>
            <button
              className="icon-button"
              aria-label="סגירת תמונה"
              onClick={() => setPreview(null)}
            >
              <X size={20} />
            </button>
          </header>
          {preview && <img src={preview} alt="תמונה מהמשימה" />}
        </div>
      </dialog>
    </div>
  );
}
