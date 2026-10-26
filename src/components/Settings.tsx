import React, { useState } from "react";
import {
  Bell,
  LogOut,
  RefreshCw,
  Settings as SettingsIcon,
  List,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../lib/store";
import { ManageButtons } from "./ManageButtons";
import { changePin } from "../firebase";
import { enablePushNotifications } from "../lib/push";
export function Settings() {
  const app = useApp();
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [repeatPin, setRepeatPin] = useState("");
  const action = async (operation: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
      toast.success(success);
    } catch {
      toast.error("הפעולה לא הושלמה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  };
  if (manage)
    return (
      <div className="page">
        <button
          className="button button-light mb-5"
          onClick={() => setManage(false)}
        >
          <ArrowRight size={17} /> חזרה להגדרות
        </button>
        <ManageButtons />
      </div>
    );
  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">בדיוק כמו שנוח לכם</p>
          <h1>הגדרות</h1>
          <p>החשבון וההעדפות שלך.</p>
        </div>
        <span className="feature-icon lavender">
          <SettingsIcon size={25} />
        </span>
      </header>
      <section className="panel">
        <div className="settings-profile">
          <span className="avatar">{app.currentUser?.name?.[0]}</span>
          <div>
            <h2>{app.currentUser?.name}</h2>
            <p>
              {app.currentUser?.points || 0} נקודות · כניסה בקוד אישי בן 4 ספרות
            </p>
          </div>
        </div>
      </section>
      <section className="panel">
        <h2>המרחב המשותף</h2>
        <div className="segmented mb-5">
          <button
            aria-pressed={app.session?.mode !== "remote"}
            disabled={busy}
            onClick={() =>
              void action(() => app.updateSessionMode("together"), "המצב עודכן")
            }
          >
            ביחד
          </button>
          <button
            aria-pressed={app.session?.mode === "remote"}
            disabled={busy}
            onClick={() =>
              void action(() => app.updateSessionMode("remote"), "המצב עודכן")
            }
          >
            מרחוק
          </button>
        </div>
        <button className="settings-row" onClick={() => setManage(true)}>
          <List size={19} />
          <span>הרעיונות שלי למשימות</span>
          <span>‹</span>
        </button>
        <button
          className="settings-row"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void enablePushNotifications()
              .then(() => toast.success("התראות פוש פעילות במכשיר הזה"))
              .catch((error) => toast.error(error instanceof Error ? error.message : "לא הצלחנו להפעיל התראות"))
              .finally(() => setBusy(false));
          }}
        >
          <Bell size={19} />
          <span>הפעלת התראות פוש במכשיר הזה</span>
          <span>‹</span>
        </button>
        <button className="settings-row" onClick={app.retrySync}>
          <RefreshCw size={19} />
          <span>חידוש החיבור והסנכרון</span>
          <span>‹</span>
        </button>
        {!!app.chatSession?.deletedAtByUser?.[app.currentUser?.id || ""] && (
          <button
            className="settings-row"
            disabled={busy}
            onClick={() => void action(app.restoreChat, "ההיסטוריה מוצגת מחדש")}
          >
            <RefreshCw size={19} />
            <span>הצגת היסטוריית השיחה שהוסתרה</span>
          </button>
        )}
      </section>
      <section className="panel">
        <h2>החשבון שלך</h2>
        <p>
          אפשר להיכנס שוב מכל מכשיר באמצעות השם והקוד האישי. התמונות וההודעות
          נשמרות במרחב המשותף.
        </p>
        <button
          className="button button-light mt-4"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await app.setCurrentUser(null);
            }, "התנתקת מהחשבון")
          }
        >
          <LogOut size={17} /> התנתקות
        </button>
      </section>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (newPin !== repeatPin) {
            toast.error("הקודים החדשים אינם תואמים");
            return;
          }
          void action(async () => {
            await changePin(oldPin, newPin);
            setOldPin("");
            setNewPin("");
            setRepeatPin("");
          }, "הקוד האישי עודכן");
        }}
      >
        <h2>בחירת קוד אישי חדש</h2>
        <p>הקוד נשמר לכל המכשירים שלך.</p>
        {[
          { label: "הקוד הנוכחי", value: oldPin, set: setOldPin },
          { label: "קוד חדש בן 4 ספרות", value: newPin, set: setNewPin },
          { label: "הקלדת הקוד החדש שוב", value: repeatPin, set: setRepeatPin },
        ].map((field) => (
          <label className="field mt-3" key={field.label}>
            {field.label}
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              autoComplete={
                field.label === "הקוד הנוכחי"
                  ? "current-password"
                  : "new-password"
              }
              value={field.value}
              onChange={(event) =>
                field.set(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              disabled={busy}
            />
          </label>
        ))}
        <button
          className="button button-primary"
          disabled={
            busy ||
            [oldPin, newPin, repeatPin].some((value) => value.length !== 4)
          }
        >
          שמירת הקוד החדש
        </button>
      </form>
      {app.currentUser?.id === "boaz" && (
        <section className="panel">
          <h2>איפוס משימות ונקודות</h2>
          <p>
            מוחק את היסטוריית המשימות ומאפס נקודות. הפעולה אינה מוחקת את הצ׳אט
            או את הכספת.
          </p>
          <button
            className="button button-danger mt-4"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "למחוק את כל המשימות ולאפס את הנקודות של שניכם? אי אפשר לבטל את הפעולה.",
                )
              )
                void action(
                  () => app.resetAllMissions("all"),
                  "המשימות והנקודות אופסו",
                );
            }}
          >
            איפוס לשנינו
          </button>
        </section>
      )}
    </div>
  );
}
