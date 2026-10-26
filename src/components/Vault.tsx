import React, { useEffect, useRef, useState } from "react";
import {
  FolderLock,
  LockKeyhole,
  Plus,
  X,
  Trash2,
  Image,
  Film,
  Play,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  addMediaToVault,
  subscribeVaultMedia,
  deleteVaultMedia,
  type VaultMedia,
} from "../lib/vaultStore";
import { verifyVaultCode } from "../lib/vaultAccess";

export function Vault() {
  const [step, setStep] = useState<1 | 2 | "open">(1);
  const [pin, setPin] = useState("");
  const [challenge, setChallenge] = useState<string>();
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const lock = () => {
    setStep(1);
    setChallenge(undefined);
    setPin("");
    setError("");
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current || step === "open" || !/^\d{4}$/.test(pin)) return;
    pending.current = true;
    setChecking(true);
    setError("");
    try {
      const result = await verifyVaultCode(step, pin, challenge);
      if (!alive.current) return;
      setPin("");
      if (step === 1) {
        setChallenge(result.challenge);
        setStep(2);
      } else {
        setChallenge(undefined);
        setStep("open");
      }
    } catch (error) {
      if (!alive.current) return;
      const message =
        error instanceof Error ? error.message : "לא ניתן לפתוח כרגע. נסו שוב.";
      setError(message);
      setPin("");
      if (
        message === "הקוד שגוי. נסו שוב." ||
        message === "יש להתחיל שוב מהקוד הראשון"
      ) {
        setStep(1);
        setChallenge(undefined);
      }
    } finally {
      pending.current = false;
      if (alive.current) setChecking(false);
    }
  };
  if (step === "open") return <VaultContents onLock={lock} />;
  return (
    <div className="page" dir="rtl">
      <header className="page-heading">
        <div>
          <p className="eyebrow">רק של שנינו</p>
          <h1>הכספת שלנו</h1>
          <p>שני קודים נדרשים לפתיחת הכספת.</p>
        </div>
        <span className="feature-icon sage">
          <FolderLock size={26} />
        </span>
      </header>
      <form className="panel mx-auto max-w-sm" onSubmit={submit}>
        <span className="pill">שלב {step} מתוך 2</span>
        <h2 className="mt-5">
          {step === 1 ? "הזינו את הקוד הראשון" : "הזינו את הקוד השני"}
        </h2>
        <p className="mb-5">
          {step === 1
            ? "הכספת נעולה. הזינו קוד בן 4 ספרות."
            : "הקוד הראשון אושר. נותר הקוד השני."}
        </p>
        <label className="field" htmlFor="vault-code">
          {step === 1 ? "קוד ראשון" : "קוד שני"}
          <input
            key={step}
            id="vault-code"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="off"
            autoFocus
            value={pin}
            disabled={checking}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
              setError("");
            }}
            aria-describedby="vault-code-error"
          />
        </label>
        <p id="vault-code-error" className="form-error" role="alert">
          {error}
        </p>
        <button
          className="button button-primary w-full"
          disabled={checking || pin.length !== 4}
        >
          <LockKeyhole size={18} />
          {checking ? "בודקים…" : step === 1 ? "המשך לקוד השני" : "פתיחת הכספת"}
        </button>
        {step === 2 && (
          <button
            type="button"
            className="button button-light w-full mt-3"
            disabled={checking}
            onClick={lock}
          >
            חזרה לקוד הראשון
          </button>
        )}
      </form>
    </div>
  );
}

function VaultContents({ onLock }: { onLock: () => void }) {
  const [media, setMedia] = useState<VaultMedia[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<VaultMedia | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    setStatus("loading");
    const timeout = setTimeout(() => setStatus("error"), 15000);
    const stop = subscribeVaultMedia(
      (items) => {
        clearTimeout(timeout);
        setMedia(items);
        setStatus("ready");
      },
      () => {
        clearTimeout(timeout);
        setStatus("error");
      },
    );
    return () => {
      clearTimeout(timeout);
      stop();
    };
  }, [attempt]);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    try {
      await addMediaToVault(
        file.type.startsWith("video/") ? "video" : "image",
        file.name,
        file,
      );
      toast.success("הקובץ נשמר בכספת");
    } catch (error) {
      toast.error(
        error instanceof Error && /[\u0590-\u05ff]/.test(error.message)
          ? error.message
          : "הקובץ לא נשמר. בדקו את החיבור ונסו שוב.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const remove = async () => {
    if (
      !selected ||
      deleting ||
      !window.confirm("למחוק את הקובץ מהכספת של שניכם? לא ניתן לבטל.")
    )
      return;
    setDeleting(true);
    try {
      await deleteVaultMedia(selected.id);
      setSelected(null);
      toast.success("הקובץ נמחק מהכספת");
    } catch {
      toast.error("המחיקה לא הושלמה. נסו שוב.");
    } finally {
      setDeleting(false);
    }
  };
  const shown = media.filter(
    (item) => filter === "all" || item.type === filter,
  );
  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">רק של שנינו</p>
          <h1>הכספת שלנו</h1>
          <p>זיכרונות פרטיים, במקום אחד.</p>
        </div>
        <span className="feature-icon sage">
          <FolderLock size={26} />
        </span>
      </header>
      <button
        className="button button-light mb-4"
        onClick={onLock}
        disabled={busy || deleting}
      >
        <LockKeyhole size={17} /> נעילת הכספת
      </button>
      <div className="toolbar">
        <div className="segmented" aria-label="סוג מדיה">
          {(
            [
              { id: "all", text: "הכול" },
              { id: "image", text: "תמונות" },
              { id: "video", text: "סרטונים" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.text}
            </button>
          ))}
        </div>
        <button
          className="button button-primary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Plus size={18} />
          {busy ? "מעלים…" : "הוספה לכספת"}
        </button>
        <input
          aria-label="בחירת קובץ לכספת"
          ref={input}
          type="file"
          accept="image/*,video/*"
          hidden
          disabled={busy}
          onChange={upload}
        />
      </div>
      {busy && (
        <p className="notice" role="status">
          מעלים ושומרים את הקובץ. השאירו את המסך פתוח עד לסיום.
        </p>
      )}
      {status === "error" && (
        <div className="notice error" role="alert">
          לא הצלחנו לטעון את הכספת.{" "}
          <button onClick={() => setAttempt((value) => value + 1)}>
            <RefreshCw size={16} /> נסו שוב
          </button>
        </div>
      )}
      {status === "loading" && (
        <div className="empty-state" role="status">
          <FolderLock size={35} />
          <h2>פותחים את הכספת…</h2>
        </div>
      )}
      {status === "ready" && !shown.length && (
        <div className="empty-state">
          <FolderLock size={42} />
          <h2>
            {media.length
              ? "אין קבצים מהסוג הזה"
              : "הזיכרון הראשון שלכם מתחיל כאן"}
          </h2>
          <p>תמונות וסרטונים עד 50 מגה, משותפים לשניכם.</p>
        </div>
      )}
      <section className="vault-grid" aria-label="קבצים בכספת">
        {shown.map((item) => (
          <button
            className="vault-tile"
            key={item.id}
            onClick={() => setSelected(item)}
            aria-label={`פתיחת ${item.name}`}
          >
            {item.type === "image" ? (
              <img src={item.url} alt={item.name} loading="lazy" />
            ) : (
              <>
                <video src={item.url} preload="metadata" muted playsInline />
                <span className="video-play">
                  <Play size={24} />
                </span>
              </>
            )}
            <span className="vault-caption">
              {item.type === "image" ? <Image size={15} /> : <Film size={15} />}
              <span>{item.name}</span>
            </span>
          </button>
        ))}
      </section>
      <dialog
        ref={dialog}
        className="media-dialog"
        onCancel={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}
      >
        <div className="media-dialog-content">
          <header>
            <span>{selected?.name}</span>
            <button
              aria-label="מחיקת הקובץ"
              className="icon-button"
              disabled={deleting}
              onClick={remove}
            >
              <Trash2 size={21} />
            </button>
            <button
              aria-label="סגירת התצוגה"
              className="icon-button"
              onClick={() => setSelected(null)}
            >
              <X size={24} />
            </button>
          </header>
          {selected?.type === "video" ? (
            <video key={selected.id} src={selected.url} controls playsInline />
          ) : (
            selected && <img src={selected.url} alt={selected.name} />
          )}
        </div>
      </dialog>
    </div>
  );
}
