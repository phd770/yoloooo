import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db, ensureAuthenticated } from "../firebase";
import { subscribeWithRecovery } from "./subscription";
import type { Zimmer, ZimmerVote } from "./types";
import { chosenWinnerId, domainOf, staleChosenIds, withSingleChosen } from "./zimmers";
import type { LinkPreview } from "../../server/link-preview";

export type { LinkPreview };
const COLLECTION = "zimmers";
export type ZimmerPatch = Partial<
  Omit<Zimmer, "id" | "createdBy" | "createdAt" | "votes">
>;

/** Realtime list of all zimmers; local writes appear instantly (latency compensation). */
export function subscribeZimmers(
  receive: (zimmers: Zimmer[]) => void,
  onError: () => void,
) {
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;
  const healing = new Set<string>();
  void ensureAuthenticated()
    .then(() => {
      if (cancelled) return;
      unsubscribe = subscribeWithRecovery(
        (ready, failed) =>
          onSnapshot(
            query(collection(db, COLLECTION)),
            { includeMetadataChanges: true },
            (snapshot) => {
              if (!snapshot.metadata.fromCache) ready();
              const zimmers = snapshot.docs.map(
                (item) =>
                  ({
                    amenities: [],
                    votes: {},
                    ...item.data(),
                    id: item.id,
                  }) as Zimmer,
              );
              // Show a single chosen zimmer even while duplicates exist, then
              // heal the server data once the snapshot is confirmed.
              receive(withSingleChosen(zimmers));
              if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites)
                for (const id of staleChosenIds(zimmers))
                  if (!healing.has(id)) {
                    healing.add(id);
                    void unsetStaleChosen(id).finally(() => healing.delete(id));
                  }
            },
            failed,
          ),
        onError,
        () => {},
      );
    })
    .catch(() => {
      if (!cancelled) onError();
    });
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

/**
 * Unset `chosen` on a zimmer that lost to a newer choice. Idempotent and safe
 * if both clients heal at once: it only writes while the doc is still chosen
 * and a different zimmer with a newer chosenAt exists.
 */
export async function unsetStaleChosen(id: string) {
  try {
    const others = await getDocs(query(collection(db, COLLECTION), where("chosen", "==", true)));
    const all = others.docs.map((item) => ({ ...item.data(), id: item.id }) as Zimmer);
    if (!chosenWinnerId(all) || chosenWinnerId(all) === id) return;
    const winnerRef = doc(db, COLLECTION, chosenWinnerId(all)!);
    const staleRef = doc(db, COLLECTION, id);
    await runTransaction(db, async (transaction) => {
      const [winner, stale] = await Promise.all([
        transaction.get(winnerRef),
        transaction.get(staleRef),
      ]);
      if (!stale.exists() || !stale.data().chosen) return;
      if (!winner.exists() || !winner.data().chosen) return;
      const staleAt = stale.data().chosenAt ?? 0;
      const winnerAt = winner.data().chosenAt ?? 0;
      if (staleAt > winnerAt || (staleAt === winnerAt && id > winner.id)) return;
      transaction.update(staleRef, {
        chosen: false,
        chosenAt: deleteField(),
        updatedAt: Date.now(),
        updatedBy: auth.currentUser?.uid ?? "system",
      });
    });
  } catch {
    // Healing is best-effort; the next snapshot retries.
  }
}

/** Firestore rejects undefined; drop those keys. */
function defined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const user = auth.currentUser;
  if (!user) throw new Error("יש להתחבר מחדש");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/link-preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
    const data = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await response.json().catch(() => null)
      : null;
    if (response.status === 401) throw new Error("יש להתחבר מחדש");
    if (!response.ok || !data?.preview)
      throw new Error(data?.error || "לא הצלחנו לקרוא את פרטי הקישור");
    return data.preview as LinkPreview;
  } catch (error) {
    if (error instanceof Error && /[֐-׿]/.test(error.message))
      throw error;
    throw new Error("לא הצלחנו לקרוא את פרטי הקישור");
  } finally {
    clearTimeout(timeout);
  }
}

/** Fields from a preview, trimmed to the sizes the security rules accept. */
export function previewToPatch(preview: LinkPreview): ZimmerPatch {
  return defined({
    title: preview.title?.slice(0, 200) || undefined,
    description: preview.description?.slice(0, 1000),
    imageUrl: preview.image && preview.image.length <= 2048 ? preview.image : undefined,
    siteName: preview.siteName?.slice(0, 100),
    priceText: preview.priceText?.slice(0, 100),
    pricePerNight: preview.priceAmount ?? undefined,
  });
}

/**
 * Create the card immediately (title = domain) so both partners see it,
 * then fill it from the server-side preview. Returns the id and whether
 * the preview succeeded.
 */
export async function addZimmerFromUrl(
  url: string,
  userId: string,
  onCreated?: (id: string) => void,
): Promise<{ id: string; previewError?: string }> {
  await ensureAuthenticated();
  const reference = doc(collection(db, COLLECTION));
  const now = Date.now();
  const created = setDoc(reference, {
    url,
    title: domainOf(url).slice(0, 200),
    amenities: [],
    customTags: [],
    votes: {},
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
    archived: false,
    chosen: false,
    previewPending: true,
  });
  onCreated?.(reference.id);
  const [creation, preview] = await Promise.allSettled([
    created,
    fetchLinkPreview(url),
  ]);
  if (creation.status === "rejected") throw creation.reason;
  const patch: ZimmerPatch =
    preview.status === "fulfilled" ? previewToPatch(preview.value) : {};
  await updateDoc(reference, {
    ...patch,
    previewPending: false,
    updatedAt: Date.now(),
    updatedBy: userId,
  });
  return {
    id: reference.id,
    previewError:
      preview.status === "rejected"
        ? preview.reason instanceof Error
          ? preview.reason.message
          : "לא הצלחנו לקרוא את פרטי הקישור"
        : undefined,
  };
}

export async function updateZimmer(id: string, patch: ZimmerPatch, userId: string) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...defined(patch),
    // Unchoosing in any way (e.g. archiving) must also drop chosenAt.
    ...(patch.chosen === false ? { chosenAt: deleteField() } : {}),
    updatedAt: Date.now(),
    updatedBy: userId,
  });
}

export async function setZimmerVote(
  id: string,
  userId: string,
  vote: ZimmerVote | null,
) {
  await updateDoc(doc(db, COLLECTION, id), {
    [`votes.${userId}`]: vote ?? deleteField(),
    updatedAt: Date.now(),
    updatedBy: userId,
  });
}

/** Mark one zimmer as the final choice and clear any previous choice. */
export async function chooseZimmer(
  id: string,
  all: Zimmer[],
  userId: string,
  chosen = true,
) {
  const batch = writeBatch(db);
  const now = Date.now();
  if (chosen)
    for (const zimmer of all)
      if (zimmer.chosen && zimmer.id !== id)
        batch.update(doc(db, COLLECTION, zimmer.id), {
          chosen: false,
          chosenAt: deleteField(),
          updatedAt: now,
          updatedBy: userId,
        });
  batch.update(doc(db, COLLECTION, id), {
    chosen,
    chosenAt: chosen ? now : deleteField(),
    archived: false,
    updatedAt: now,
    updatedBy: userId,
  });
  await batch.commit();
}

export async function deleteZimmer(id: string) {
  await deleteDoc(doc(db, COLLECTION, id));
}
