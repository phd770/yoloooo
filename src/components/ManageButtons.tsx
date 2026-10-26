import React, { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../lib/store";
import type { CustomButton } from "../lib/types";
export function ManageButtons() {
  const {
    currentUser,
    addCustomButton,
    updateCustomButton,
    deleteCustomButton,
  } = useApp();
  const [editing, setEditing] = useState<Partial<CustomButton> | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !editing ||
      busy ||
      !editing.label?.trim() ||
      !editing.actionText?.trim()
    )
      return;
    setBusy(true);
    try {
      const value = {
        ...editing,
        label: editing.label.trim(),
        actionText: editing.actionText.trim(),
        pointsValue: editing.pointsValue ?? 10,
      };
      if (value.id) await updateCustomButton(value as CustomButton);
      else await addCustomButton(value as Omit<CustomButton, "id">);
      setEditing(null);
      toast.success("הרעיון נשמר");
    } catch {
      toast.error("השמירה נכשלה. התוכן נשמר בטופס.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (button: CustomButton) => {
    if (busy || !window.confirm(`למחוק את הרעיון ״${button.label}״?`)) return;
    setBusy(true);
    try {
      await deleteCustomButton(button);
      toast.success("הרעיון נמחק");
    } catch {
      toast.error("המחיקה נכשלה");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <div className="section-title">
        <h2>הרעיונות שלי למשימות</h2>
        <button
          className="button button-primary"
          disabled={busy}
          onClick={() => setEditing({ pointsValue: 10 })}
        >
          <Plus size={17} /> רעיון חדש
        </button>
      </div>
      <p className="muted mb-5">הרעיונות מופיעים בבחירת משימה חדשה.</p>
      {editing && (
        <form className="panel" onSubmit={save}>
          <label className="field">
            שם הרעיון
            <input
              required
              maxLength={100}
              disabled={busy}
              value={editing.label || ""}
              onChange={(event) =>
                setEditing({ ...editing, label: event.target.value })
              }
            />
          </label>
          <label className="field">
            תיאור המשימה
            <textarea
              required
              maxLength={1000}
              disabled={busy}
              value={editing.actionText || ""}
              onChange={(event) =>
                setEditing({ ...editing, actionText: event.target.value })
              }
            />
          </label>
          <label className="field">
            פרטים נוספים
            <textarea
              maxLength={2000}
              disabled={busy}
              value={editing.fullText || ""}
              onChange={(event) =>
                setEditing({ ...editing, fullText: event.target.value })
              }
            />
          </label>
          <label className="field">
            נקודות
            <input
              type="number"
              min={0}
              max={100}
              required
              disabled={busy}
              value={editing.pointsValue ?? 10}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  pointsValue: Number(event.target.value),
                })
              }
            />
          </label>
          <div className="action-row">
            <button className="button button-primary" disabled={busy}>
              {busy ? "שומרים…" : "שמירה"}
            </button>
            <button
              type="button"
              className="button button-light"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              ביטול
            </button>
          </div>
        </form>
      )}
      {(currentUser?.buttons || []).map((button) => (
        <article className="panel" key={button.id}>
          <h2>{button.label}</h2>
          <p>{button.actionText}</p>
          <div className="action-row mt-4">
            <span className="pill">{button.pointsValue} נקודות</span>
            <button
              className="icon-button"
              aria-label={`עריכת ${button.label}`}
              disabled={busy}
              onClick={() => setEditing({ ...button })}
            >
              <Pencil size={18} />
            </button>
            <button
              className="icon-button"
              aria-label={`מחיקת ${button.label}`}
              disabled={busy}
              onClick={() => void remove(button)}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
