import React, { useEffect, useMemo, useRef, useState } from "react";
import { BedDouble, Link2, Plus } from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { useApp } from "../lib/store";
import type { Zimmer } from "../lib/types";
import {
  filterZimmers,
  isMatch,
  listingKey,
  normalizeListingUrl,
  sortZimmers,
  type ZimmerFilter,
  type ZimmerSort,
} from "../lib/zimmers";
import { addZimmerFromUrl, subscribeZimmers } from "../lib/zimmerStore";
import { ZimmerCard, ZimmerCardSkeleton } from "./ZimmerCard";

const filters: { id: ZimmerFilter; text: string }[] = [
  { id: "all", text: "הכל" },
  { id: "match", text: "שנינו אהבנו" },
  { id: "undecided", text: "עוד לא הוחלט" },
  { id: "rejected", text: "נפסלו" },
  { id: "archived", text: "ארכיון" },
];
const sorts: { id: ZimmerSort; text: string }[] = [
  { id: "added", text: "לפי תאריך הוספה" },
  { id: "price", text: "לפי מחיר" },
  { id: "match", text: "לפי התאמה" },
];

function celebrate() {
  try {
    void confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.55 },
      colors: ["#b9506c", "#f3c4d1", "#ffd36e", "#ffffff"],
      disableForReducedMotion: true,
    });
  } catch {}
}

export function Zimmers() {
  const { currentUser, partner } = useApp();
  const [zimmers, setZimmers] = useState<Zimmer[] | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [filter, setFilter] = useState<ZimmerFilter>("all");
  const [sort, setSort] = useState<ZimmerSort>("added");
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const chosenId = useRef<string | null | undefined>(undefined);

  useEffect(
    () =>
      subscribeZimmers(
        (items) => {
          setSyncError(false);
          setZimmers(items);
        },
        () => setSyncError(true),
      ),
    [],
  );

  // Celebrate whenever a new final choice appears, by either partner.
  useEffect(() => {
    if (!zimmers) return;
    const current = zimmers.find((item) => item.chosen)?.id ?? null;
    if (chosenId.current !== undefined && current && current !== chosenId.current)
      celebrate();
    chosenId.current = current;
  }, [zimmers]);

  const visible = useMemo(
    () => (zimmers ? sortZimmers(filterZimmers(zimmers, filter), sort) : []),
    [zimmers, filter, sort],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map(({ id }) => [id, zimmers ? filterZimmers(zimmers, id).length : 0]),
      ) as Record<ZimmerFilter, number>,
    [zimmers],
  );

  if (!currentUser) return null;

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (adding) return;
    const url = normalizeListingUrl(draft);
    if (!url) {
      setInputError("זה לא נראה כמו קישור. הדביקו כתובת שמתחילה ב־https://");
      return;
    }
    const key = listingKey(url);
    const existing = zimmers?.find((item) => listingKey(item.url) === key);
    if (existing) {
      setInputError("הצימר הזה כבר ברשימה");
      return;
    }
    setInputError("");
    setAdding(true);
    setFilter((value) => (value === "all" ? value : "all"));
    try {
      const result = await addZimmerFromUrl(url, currentUser.id, () => setDraft(""));
      if (result.previewError) {
        toast.warning(`${result.previewError}. הקישור נשמר — אפשר למלא את הפרטים ידנית.`);
        setEditingId(result.id);
      } else toast.success("הצימר נוסף");
    } catch (error) {
      console.error("[zimmers] add failed", error);
      setDraft((value) => value || url);
      toast.error("לא הצלחנו לשמור את הקישור. נסו שוב.");
    } finally {
      setAdding(false);
    }
  };

  const matches = zimmers?.filter((item) => !item.archived && isMatch(item)).length ?? 0;
  const active = zimmers?.filter((item) => !item.archived).length ?? 0;

  return (
    <div className="page" dir="rtl">
      <header className="page-heading">
        <div>
          <p className="eyebrow">החופשה הבאה שלנו</p>
          <h1>בחירת צימר</h1>
          <p>
            {zimmers
              ? active
                ? `${active} אפשרויות · ${matches} התאמות`
                : "מדביקים קישורים, מצביעים, ובוחרים ביחד."
              : "טוענים את הרשימה…"}
          </p>
        </div>
        <span className="feature-icon rose">
          <BedDouble size={25} />
        </span>
      </header>

      {syncError && (
        <p role="alert" className="notice">
          הרשימה לא מתעדכנת כרגע. ננסה להתחבר שוב אוטומטית.
        </p>
      )}

      <form className="panel !p-4" onSubmit={add} noValidate>
        <label htmlFor="zimmer-url" className="mb-2 block text-[13px] font-bold">
          הוספת צימר מקישור
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Link2
              size={17}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#b7a9af]"
            />
            <input
              id="zimmer-url"
              dir="ltr"
              type="url"
              inputMode="url"
              autoComplete="off"
              enterKeyHint="go"
              value={draft}
              maxLength={4000}
              onChange={(event) => {
                setDraft(event.target.value);
                if (inputError) setInputError("");
              }}
              placeholder="Airbnb, Booking, Zimmer…"
              aria-invalid={!!inputError}
              aria-describedby={inputError ? "zimmer-url-error" : undefined}
              className="w-full rounded-[10px] border border-[#e2d6dc] bg-white py-3 pl-3 pr-9 text-left"
            />
          </div>
          <button className="button button-primary shrink-0" disabled={adding || !draft.trim()}>
            <Plus size={17} /> {adding ? "מוסיפים…" : "הוספה"}
          </button>
        </div>
        {inputError && (
          <p id="zimmer-url-error" role="alert" className="mt-2 !text-xs !text-[#ad3944]">
            {inputError}
          </p>
        )}
      </form>

      <div className="toolbar">
        <div className="segmented max-w-full overflow-x-auto" role="group" aria-label="סינון">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className="whitespace-nowrap"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.text}
              {zimmers && counts[item.id] ? ` (${counts[item.id]})` : ""}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-[#8a7982]">
          מיון
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as ZimmerSort)}
            className="rounded-[10px] border border-[#e2d6dc] bg-white px-2 py-2"
          >
            {sorts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.text}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!zimmers ? (
        <div className="grid gap-4 sm:grid-cols-2" role="status" aria-label="טוענים">
          <ZimmerCardSkeleton />
          <ZimmerCardSkeleton />
        </div>
      ) : !visible.length ? (
        <div className="empty-state">
          <BedDouble size={40} />
          <h2>{zimmers.length ? "אין כאן צימרים בסינון הזה" : "עוד אין צימרים"}</h2>
          <p>
            {zimmers.length
              ? "אפשר לבחור סינון אחר."
              : "הדביקו קישור לצימר שמצא חן בעיניכם ונתחיל לבחור ביחד."}
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {visible.map((zimmer) => (
            <React.Fragment key={zimmer.id}>
              <ZimmerCard
                zimmer={zimmer}
                all={zimmers}
                me={currentUser}
                partner={partner}
                editing={editingId === zimmer.id}
                onEditChange={(open) => setEditingId(open ? zimmer.id : null)}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
