import React from "react";
import { Bell, Calculator, Gift, Heart, LockKeyhole, MessageCircle, Users } from "lucide-react";
import type { AppTab } from "./Layout";

export function Home({ onNavigate }: { onNavigate?: (tab: AppTab) => void }) {
  const shortcuts = [
    { label: "השיחה שלנו", icon: MessageCircle, tab: "chat" },
    { label: "הטבות", icon: Gift, tab: "inbox" },
    { label: "הכספת שלנו", icon: LockKeyhole, tab: "vault" },
    { label: "משחקים ביחד", icon: Calculator, tab: "games" },
  ] as const;

  return (
    <div className="reference-home page" dir="rtl">
      <header className="reference-home-header">
        <img src="/home-reference.jpeg" alt="" aria-hidden="true" fetchPriority="high" />
        <button type="button" className="reference-bell-hit" aria-label="פתיחת ההודעות" onClick={() => onNavigate?.("chat")} />
      </header>
      <section className="reference-home-hero" aria-label="עולם שלם של הורות">
        <img src="/home-reference.jpeg" alt="" aria-hidden="true" loading="lazy" />
        <button type="button" className="reference-hero-hit" aria-label="פתיחת הפרופיל" onClick={() => onNavigate?.("settings")} />
      </section>
      <div className="reference-shortcuts-wrap">
        <nav className="reference-shortcuts" aria-label="קיצורי דרך">
          {shortcuts.map(({ label, icon: Icon, tab }) => (
            <button type="button" key={tab} onClick={() => onNavigate?.(tab)}>
              <span><Icon size={27} strokeWidth={1.5} /></span>
              <strong>{label}</strong>
            </button>
          ))}
        </nav>
      </div>
      <section className="reference-feature" aria-label="תוכן חדש">
        <div className="reference-feature-picture">
          <img src="/home-reference.jpeg" alt="מכונת כתיבה ישנה" loading="lazy" />
        </div>
        <div className="reference-dots" aria-hidden="true"><i /><i /><i /></div>
      </section>
      <section className="reference-tips">
        <h2>כלים שימושיים</h2>
        <div className="reference-tips-grid">
          <button type="button" onClick={() => onNavigate?.("inbox")}>
            <Gift size={27} />
            <span>הטבות ומשימות</span>
          </button>
          <button type="button" onClick={() => onNavigate?.("games")}>
            <Users size={27} />
            <span>משחקים לשנינו</span>
          </button>
          <button type="button" onClick={() => onNavigate?.("vault")}>
            <Heart size={27} />
            <span>הרגעים שלנו</span>
          </button>
        </div>
      </section>
      <button className="reference-hidden-bell" type="button" onClick={() => onNavigate?.("chat")} aria-label="התראות">
        <Bell size={20} />
      </button>
    </div>
  );
}
