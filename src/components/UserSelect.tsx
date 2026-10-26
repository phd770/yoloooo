import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { signInWithPin, warmUpLogin, type AllowedProfileId } from "../firebase";

export function UserSelect() {
  const [profile, setProfile] = useState<AllowedProfileId | null>(null);
  const [pin, setPin] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  useEffect(() => warmUpLogin(), []);

  const choose = (id: AllowedProfileId) => {
    setProfile(id);
    setPin("");
    setError("");
    setVisible(false);
  };

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || sending.current || !/^\d{4}$/.test(pin)) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await signInWithPin(profile, pin);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(/[\u0590-\u05ff]/.test(message) ? message : "לא הצלחנו להתחבר. נסו שוב.");
      if (message === "הקוד שגוי. נסו שוב.") setPin("");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <main className="welcome-screen" dir="rtl">
      <div className={`welcome-art ${profile ? "welcome-art-small" : ""}`} role="img" aria-label="ידיים אוחזות ברגלי תינוק, לוגו my baby land">
        <img src="/login-reference.jpeg" alt="" aria-hidden="true" />
      </div>
      <section className="welcome-sheet">
        {profile ? (
          <form className="welcome-pin-form" onSubmit={login}>
            <button className="welcome-back" type="button" onClick={() => setProfile(null)} aria-label="חזרה למסך הכניסה">
              <ArrowRight size={22} />
            </button>
            <p className="welcome-kicker">הבית שלנו מחכה לך</p>
            <h1>כניסה של {profile === "mishel" ? "קרן" : "שירן"}</h1>
            <p className="welcome-description">יש להזין את הקוד האישי בן ארבע הספרות.</p>
            <label htmlFor="login-pin">הקוד האישי שלך</label>
            <div className="pin-field">
              <input
                id="login-pin"
                type={visible ? "text" : "password"}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4}"
                maxLength={4}
                placeholder="••••"
                value={pin}
                disabled={busy}
                onChange={(event) => {
                  setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                  setError("");
                }}
                aria-describedby="login-error"
              />
              <button type="button" aria-label={visible ? "הסתרת קוד" : "הצגת קוד"} onClick={() => setVisible((value) => !value)}>
                {visible ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p id="login-error" className="form-error" role="alert">{error}</p>
            <button className="welcome-primary" type="submit" disabled={busy || pin.length !== 4}>
              {busy ? "מתחברים…" : "כניסה לבית שלנו"}
            </button>
            <button className="welcome-secondary" type="button" disabled={busy} onClick={() => choose(profile === "mishel" ? "boaz" : "mishel")}>
              מעבר ל{profile === "mishel" ? "שירן" : "קרן"}
            </button>
          </form>
        ) : (
          <div className="welcome-copy">
            <h1>הבית החדש שלך ושל הבייבי</h1>
            <p>
              מהצעד הראשון בהריון ועד רגעי ההורות המרגשים, אנחנו כאן כדי לעטוף אותך.
              סדנאות, יועצות, הטבות והפעילויות הכי שוות מחכות בפנים.
            </p>
            <p>פתחי פרופיל ותהני מעולם חדש של תוכן</p>
            <button className="welcome-primary" type="button" onClick={() => choose("mishel")}>התחברות או הרשמה</button>
            <button className="welcome-secondary" type="button" onClick={() => choose("boaz")}>מאוחר יותר</button>
          </div>
        )}
      </section>
    </main>
  );
}
