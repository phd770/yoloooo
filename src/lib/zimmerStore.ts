import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db, ensureAuthenticated } from "../firebase";
import { subscribeWithRecovery } from "./subscription";
import type { Zimmer, ZimmerVote } from "./types";
import { domainOf } from "./zimmers";
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
              receive(
                snapshot.docs.map(
                  (item) =>
                    ({
                      amenities: [],
                      votes: {},
                      ...item.data(),
                      id: item.id,
                    }) as Zimmer,
                ),
              );
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
