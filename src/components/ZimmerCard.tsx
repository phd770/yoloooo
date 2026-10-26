import React, { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BedDouble,
  CalendarDays,
  Crown,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { User, Zimmer, ZimmerVote } from "../lib/types";
import {
  AMENITIES,
  AMENITY_LABELS,
  VOTES,
  effectiveNights,
  formatDateRange,
  formatPrice,
  isMatch,
  nextVote,
  nightsBetween,
  toggleInList,
  totalPrice,
} from "../lib/zimmers";
import {
  chooseZimmer,
  deleteZimmer,
  setZimmerVote,
  updateZimmer,
  type ZimmerPatch,
} from "../lib/zimmerStore";

const PREVIEW_STALE_MS = 30_000;

export function isPreviewLoading(zimmer: Zimmer, now = Date.now()) {
  return !!zimmer.previewPending && now - zimmer.createdAt < PREVIEW_STALE_MS;
}

function failed(message: string) {
  return (error: unknown) => {
    console.error("[zimmers]", error instanceof Error ? error.message : error);
    toast.error(message);
  };
}

function VoteLabel({ user, vote }: { user: User | null; vote?: ZimmerVote }) {
  if (!user) return null;
  const option = VOTES.find((item) => item.id === vote);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f6f1ef] px-2.5 py-1 text-xs text-[#6f5d66]">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#f3e3e8] text-[10px] font-bold text-[#a34561]">
        {user.name?.[0]}
      </span>
      {option ? (
        <>
          <span aria-hidden="true">{option.emoji}</span> {option.label}
        </>
      ) : (
        <span className="text-[#a3939a]">
          {user.gender === "female" ? "עוד לא בחרה" : "עוד לא בחר"}
        </span>
      )}
    </span>
  );
}

export function ZimmerCardSkeleton() {
  return (
    <div className="panel !p-0 overflow-hidden" aria-hidden="true">
      <div className="aspect-[16/9] animate-pulse bg-[#f2eeeb]" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-2/3 animate-pulse rounded bg-[#f2eeeb]" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-[#f2eeeb]" />
        <div className="h-9 w-full animate-pulse rounded-xl bg-[#f2eeeb]" />
      </div>
    </div>
  );
}

export function ZimmerCard({
  zimmer,
  all,
  me,
  partner,
  editing,
  onEditChange,
}: {
  zimmer: Zimmer;
  all: Zimmer[];
  me: User;
  partner: User | null;
  editing: boolean;
  onEditChange: (open: boolean) => void;
}) {
  const [imageBroken, setImageBroken] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const loading = isPreviewLoading(zimmer);
  const match = isMatch(zimmer);
  const myVote = zimmer.votes?.[me.id];
  const partnerVote = partner ? zimmer.votes?.[partner.id] : undefined;
  const nights = effectiveNights(zimmer);
  const total = totalPrice(zimmer);
  const dates = formatDateRange(zimmer.checkIn, zimmer.checkOut);
  const tags = [
    ...zimmer.amenities.map((id) => AMENITY_LABELS[id] || id),
    ...(zimmer.customTags || []),
  ];

  const vote = (clicked: ZimmerVote) =>
    setZimmerVote(zimmer.id, me.id, nextVote(myVote, clicked)).catch(
      failed("ההצבעה לא נשמרה. נסו שוב."),
    );

  return (
    <article
      className={`panel !mb-0 !p-0 overflow-hidden transition-shadow ${
        zimmer.chosen
          ? "ring-2 ring-[#b9506c] shadow-[0_8px_30px_#b9506c26]"
          : match
            ? "ring-1 ring-[#e7b6c4]"
            : ""
      } ${zimmer.archived ? "opacity-70" : ""}`}
      aria-busy={loading || undefined}
    >
      <div className="relative aspect-[16/9] bg-[#f6eef0]">
        {loading ? (
          <div className="h-full w-full animate-pulse bg-[#f2eeeb]" />
        ) : zimmer.imageUrl && !imageBroken ? (
          <img
            src={zimmer.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onError={() => setImageBroken(true)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[#d0a5b3]">
            <BedDouble size={44} strokeWidth={1.3} />
          </div>
        )}
        <div className="absolute right-3 top-3 flex flex-wrap gap-1.5">
          {zimmer.chosen && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#b9506c] px-3 py-1 text-xs font-bold text-white shadow">
              <Crown size={13} /> נבחר!
            </span>
          )}
          {match && (
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[#a34260] shadow">
              💞 התאמה! שניכם אהבתם
            </span>
          )}
        </div>
        {zimmer.siteName && !loading && (
          <span className="absolute bottom-2 left-2 max-w-[60%] truncate rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] text-white">
            {zimmer.siteName}
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        {loading ? (
          <div className="space-y-2" role="status" aria-label="טוענים את פרטי הקישור">
            <div className="h-5 w-3/4 animate-pulse rounded bg-[#f2eeeb]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-[#f2eeeb]" />
          </div>
        ) : (
          <div>
            <h2 className="text-[17px] font-bold leading-snug text-[#342d34]">
              {zimmer.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8a7e85]">
              {zimmer.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {zimmer.location}
                </span>
              )}
              {dates && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={13} /> {dates}
                </span>
              )}
            </div>
            {zimmer.description && (
              <p className="mt-2 line-clamp-2 !text-xs !leading-relaxed">
                {zimmer.description}
              </p>
            )}
          </div>
        )}

        {(zimmer.pricePerNight || zimmer.priceText) && (
          <div className="rounded-xl bg-[#faf5f5] px-3 py-2 text-sm text-[#5d4b54]">
            {zimmer.pricePerNight ? (
              <>
                <strong>{formatPrice(zimmer.pricePerNight)}</strong> ללילה
                {nights ? ` × ${nights} לילות` : ""}
                {total ? (
                  <>
                    {" "}
                    = <strong className="text-[#a34260]">{formatPrice(total)}</strong>
                  </>
                ) : null}
              </>
            ) : (
              <span className="text-xs">מחיר מהאתר: {zimmer.priceText}</span>
            )}
          </div>
        )}

        {!!tags.length && (
          <ul className="flex flex-wrap gap-1.5" aria-label="תנאים">
            {tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-[#eadde2] bg-white px-2.5 py-0.5 text-[11px] text-[#7b5261]"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
        {(zimmer.checkInTime || zimmer.checkOutTime || zimmer.cancellationPolicy) && (
          <p className="!text-xs !leading-relaxed">
            {zimmer.checkInTime && `צ'ק־אין ${zimmer.checkInTime}`}
            {zimmer.checkInTime && zimmer.checkOutTime && " · "}
            {zimmer.checkOutTime && `צ'ק־אאוט ${zimmer.checkOutTime}`}
            {zimmer.cancellationPolicy && (
              <span className="block">ביטול: {zimmer.cancellationPolicy}</span>
            )}
          </p>
        )}
        {zimmer.notes && (
          <p className="whitespace-pre-wrap rounded-xl border border-dashed border-[#eadde2] px-3 py-2 !text-xs">
            {zimmer.notes}
          </p>
        )}

        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="ההצבעה שלי">
          {VOTES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={myVote === option.id}
              onClick={() => vote(option.id)}
              className={`min-h-[44px] rounded-xl border px-1 text-xs font-bold transition-colors ${
                myVote === option.id
                  ? "border-[#b9506c] bg-[#f9edf0] text-[#a34260]"
                  : "border-[#eee8e6] bg-white text-[#82747c] hover:bg-[#faf5f5]"
              }`}
            >
              <span aria-hidden="true">{option.emoji}</span> {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <VoteLabel user={me} vote={myVote} />
          <VoteLabel user={partner} vote={partnerVote} />
        </div>

        <div className="flex flex-wrap items-center gap-1 border-t border-[#f0eaea] pt-3">
          <button
            type="button"
            className={`button !min-h-[40px] !px-3 !py-2 !text-xs ${
              zimmer.chosen ? "button-light" : "button-primary"
            }`}
            onClick={() =>
              chooseZimmer(zimmer.id, all, me.id, !zimmer.chosen).catch(
                failed("הבחירה לא נשמרה. נסו שוב."),
              )
            }
          >
            <Crown size={15} /> {zimmer.chosen ? "ביטול הבחירה" : "נבחר!"}
          </button>
          <a
            className="icon-button text-[#7b5261]"
            href={zimmer.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="פתיחת המודעה"
            title="פתיחת המודעה"
          >
            <ExternalLink size={18} />
          </a>
          <button
            type="button"
            className="icon-button text-[#7b5261]"
            aria-label="עריכה"
            title="עריכה"
            aria-expanded={editing}
            disabled={loading}
            onClick={() => onEditChange(!editing)}
          >
            <Pencil size={18} />
          </button>
          <button
            type="button"
            className="icon-button text-[#7b5261]"
            aria-label={zimmer.archived ? "החזרה מהארכיון" : "העברה לארכיון"}
            title={zimmer.archived ? "החזרה מהארכיון" : "העברה לארכיון"}
            onClick={() =>
              updateZimmer(
                zimmer.id,
                zimmer.archived ? { archived: false } : { archived: true, chosen: false },
                me.id,
              ).catch(failed("השינוי לא נשמר. נסו שוב."))
            }
          >
            {zimmer.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
          </button>
          {confirmDelete ? (
            <span className="ms-auto flex items-center gap-1">
              <button
                type="button"
                className="button button-danger !min-h-[40px] !px-3 !py-2 !text-xs"
                onClick={() =>
                  deleteZimmer(zimmer.id).catch(failed("המחיקה נכשלה. נסו שוב."))
                }
              >
                למחוק סופית?
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="ביטול מחיקה"
                onClick={() => setConfirmDelete(false)}
              >
                <X size={16} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="icon-button ms-auto text-[#ad3944]"
              aria-label="מחיקה"
              title="מחיקה"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {editing && (
          <ZimmerEditor
            zimmer={zimmer}
            userId={me.id}
            onClose={() => onEditChange(false)}
          />
        )}
      </div>
    </article>
  );
}

function numberOrNull(value: string, max: number): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= max ? number : null;
}

function ZimmerEditor({
  zimmer,
  userId,
  onClose,
}: {
  zimmer: Zimmer;
  userId: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => ({
    title: zimmer.title || "",
    location: zimmer.location || "",
    url: zimmer.url || "",
    imageUrl: zimmer.imageUrl || "",
    pricePerNight: zimmer.pricePerNight ? String(zimmer.pricePerNight) : "",
    nights: zimmer.nights ? String(zimmer.nights) : "",
    checkIn: zimmer.checkIn || "",
    checkOut: zimmer.checkOut || "",
    checkInTime: zimmer.checkInTime || "",
    checkOutTime: zimmer.checkOutTime || "",
    cancellationPolicy: zimmer.cancellationPolicy || "",
    notes: zimmer.notes || "",
  }));
  const [amenities, setAmenities] = useState<string[]>(zimmer.amenities || []);
  const [customTags, setCustomTags] = useState<string[]>(zimmer.customTags || []);
  const [tagDraft, setTagDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));
  const autoNights = nightsBetween(form.checkIn, form.checkOut);
  const previewTotal = totalPrice({
    pricePerNight: numberOrNull(form.pricePerNight, 100_000),
    nights: numberOrNull(form.nights, 60),
    checkIn: form.checkIn,
    checkOut: form.checkOut,
  });

  const addTag = () => {
    const tag = tagDraft.trim().slice(0, 40);
    if (!tag) return;
    if (!customTags.includes(tag) && customTags.length < 20)
      setCustomTags([...customTags, tag]);
    setTagDraft("");
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const title = form.title.trim();
    if (!title) return toast.error("צריך שם לצימר");
    const url = form.url.trim();
    const imageUrl = form.imageUrl.trim();
    const validHttp = (value: string) => /^https?:\/\/\S+$/i.test(value);
    if (!validHttp(url)) return toast.error("הקישור צריך להתחיל ב־https://");
    if (imageUrl && !validHttp(imageUrl))
      return toast.error("קישור התמונה צריך להתחיל ב־https://");
    if (form.checkIn && form.checkOut && !autoNights)
      return toast.error("תאריך היציאה צריך להיות אחרי תאריך ההגעה");
    const patch: ZimmerPatch = {
      title: title.slice(0, 200),
      location: form.location.trim().slice(0, 200),
      url: url.slice(0, 2048),
      imageUrl: imageUrl.slice(0, 2048),
      pricePerNight: numberOrNull(form.pricePerNight, 100_000),
      nights: numberOrNull(form.nights, 60),
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      checkInTime: form.checkInTime,
      checkOutTime: form.checkOutTime,
      cancellationPolicy: form.cancellationPolicy.trim().slice(0, 300),
      notes: form.notes.trim().slice(0, 2000),
      amenities,
      customTags,
      previewPending: false,
    };
    setSaving(true);
    // Firestore applies the write locally first, so close right away.
    onClose();
    try {
      await updateZimmer(zimmer.id, patch, userId);
    } catch (error) {
      failed("השינויים לא נשמרו. נסו שוב.")(error);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "!py-2.5";
  return (
    <form onSubmit={save} className="mt-2 rounded-2xl bg-[#faf7f6] p-3">
      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          שם הצימר
          <input className={inputClass} required maxLength={200} value={form.title} onChange={set("title")} />
        </label>
        <label className="field">
          אזור / מיקום
          <input className={inputClass} maxLength={200} value={form.location} onChange={set("location")} placeholder="למשל: גליל עליון" />
        </label>
        <label className="field">
          מחיר ללילה (₪)
          <input className={inputClass} type="number" inputMode="numeric" min={0} max={100000} value={form.pricePerNight} onChange={set("pricePerNight")} />
        </label>
        <label className="field">
          תאריך הגעה
          <input className={inputClass} type="date" value={form.checkIn} onChange={set("checkIn")} />
        </label>
        <label className="field">
          תאריך עזיבה
          <input className={inputClass} type="date" value={form.checkOut} min={form.checkIn || undefined} onChange={set("checkOut")} />
        </label>
        <label className="field">
          מספר לילות
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={form.nights}
            placeholder={autoNights ? `${autoNights} (לפי התאריכים)` : ""}
            onChange={set("nights")}
          />
        </label>
        <div className="field">
          סה"כ
          <output className="rounded-[10px] border border-[#e2d6dc] bg-white px-3 py-2.5 font-bold text-[#a34260]">
            {previewTotal ? formatPrice(previewTotal) : "—"}
          </output>
        </div>
        <label className="field">
          שעת צ'ק־אין
          <input className={inputClass} type="time" value={form.checkInTime} onChange={set("checkInTime")} />
        </label>
        <label className="field">
          שעת צ'ק־אאוט
          <input className={inputClass} type="time" value={form.checkOutTime} onChange={set("checkOutTime")} />
        </label>
        <label className="field sm:col-span-2">
          מדיניות ביטול
          <input className={inputClass} maxLength={300} value={form.cancellationPolicy} onChange={set("cancellationPolicy")} placeholder="למשל: ביטול חינם עד 7 ימים לפני" />
        </label>
        <label className="field sm:col-span-2">
          קישור למודעה
          <input className={inputClass} type="url" dir="ltr" maxLength={2048} value={form.url} onChange={set("url")} />
        </label>
        <label className="field sm:col-span-2">
          קישור לתמונה
          <input className={inputClass} type="url" dir="ltr" maxLength={2048} value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://…" />
        </label>
      </div>

      <fieldset className="mb-4">
        <legend className="mb-2 text-[13px]">תנאים</legend>
        <div className="flex flex-wrap gap-1.5">
          {AMENITIES.map((amenity) => {
            const on = amenities.includes(amenity.id);
            return (
              <button
                key={amenity.id}
                type="button"
                aria-pressed={on}
                onClick={() => setAmenities(toggleInList(amenities, amenity.id))}
                className={`min-h-[36px] rounded-full border px-3 text-xs ${
                  on
                    ? "border-[#b9506c] bg-[#f9edf0] font-bold text-[#a34260]"
                    : "border-[#e2d6dc] bg-white text-[#82747c]"
                }`}
              >
                {on ? "✓ " : ""}
                {amenity.label}
              </button>
            );
          })}
          {customTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setCustomTags(toggleInList(customTags, tag))}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[#b9506c] bg-[#f9edf0] px-3 text-xs font-bold text-[#a34260]"
              aria-label={`הסרת ${tag}`}
            >
              {tag} <X size={12} />
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-[10px] border border-[#e2d6dc] bg-white px-3 py-2"
            value={tagDraft}
            maxLength={40}
            placeholder="תנאי נוסף (למשל: מותר כלבים)"
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTag();
              }
            }}
          />
          <button type="button" className="button button-light !min-h-[40px] !px-3" onClick={addTag} aria-label="הוספת תנאי">
            <Plus size={16} />
          </button>
        </div>
      </fieldset>

      <label className="field">
        הערות
        <textarea maxLength={2000} value={form.notes} onChange={set("notes")} placeholder="מה חשוב לזכור על המקום הזה?" />
      </label>
      <div className="action-row">
        <button className="button button-primary" disabled={saving}>
          שמירה
        </button>
        <button type="button" className="button button-light" onClick={onClose}>
          ביטול
        </button>
      </div>
    </form>
  );
}
