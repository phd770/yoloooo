import { ensureAuthenticated, db, storage } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  onSnapshot,
} from "firebase/firestore";
import { subscribeWithRecovery } from "./subscription";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
export interface VaultMedia {
  id: string;
  type: "image" | "video";
  name: string;
  storagePath: string;
  url: string;
  thumbnail?: string | null;
  createdAt: number;
}
const CACHE_KEY = "dateapp_local_vault";
export const MAX_MEDIA_SIZE = 50 * 1024 * 1024;
const saveCache = (media: VaultMedia[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(media));
  } catch {}
};
export function validateMedia(data: Blob) {
  if (!/^(image|video)\//.test(data.type))
    throw new Error("אפשר להעלות רק תמונות וסרטונים");
  if (!data.size) throw new Error("הקובץ ריק");
  if (data.size >= MAX_MEDIA_SIZE)
    throw new Error("יש לבחור קובץ קטן מ־50 מגה");
}
export async function addMediaToVault(
  type: "image" | "video",
  name: string,
  data: Blob,
  thumbnail?: string,
): Promise<string> {
  validateMedia(data);
  if (!data.type.startsWith(`${type}/`)) throw new Error("סוג הקובץ אינו תואם");
  await ensureAuthenticated();
  const id = crypto.randomUUID();
  const storagePath = `vault/${id}-${name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "media"}`;
  const target = ref(storage, storagePath);
  await uploadBytes(target, data, { contentType: data.type });
  try {
    const url = await getDownloadURL(target);
    await setDoc(doc(db, "vault", id), {
      id,
      type,
      name,
      storagePath,
      url,
      thumbnail: thumbnail || null,
      createdAt: Date.now(),
    });
  } catch (error) {
    // Roll back an uploaded object when its catalogue record could not be saved.
    await deleteObject(target).catch(() => {});
    throw error;
  }
  return id;
}
export async function addUrlToVault(
  type: "image" | "video",
  name: string,
  url: string,
  thumbnail?: string,
): Promise<string> {
  if (!/^https:\/\//i.test(url)) throw new Error("קישור המדיה אינו תקין");
  await ensureAuthenticated();
  const id = crypto.randomUUID();
  await setDoc(doc(db, "vault", id), {
    id,
    type,
    name,
    storagePath: "",
    url,
    thumbnail: thumbnail || null,
    createdAt: Date.now(),
  });
  return id;
}
export function subscribeVaultMedia(
  receive: (media: VaultMedia[]) => void,
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
            query(collection(db, "vault")),
            { includeMetadataChanges: true },
            (snapshot) => {
              if (snapshot.metadata.fromCache && snapshot.empty) return;
              if (!snapshot.metadata.fromCache) ready();
              const media = snapshot.docs
                .map((item) => ({ ...item.data(), id: item.id }) as VaultMedia)
                .sort((a, b) => b.createdAt - a.createdAt);
              saveCache(media);
              receive(media);
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
export async function getVaultMedia(): Promise<VaultMedia[]> {
  await ensureAuthenticated();
  const snapshot = await getDocs(collection(db, "vault"));
  const media = snapshot.docs
    .map((item) => ({ ...item.data(), id: item.id }) as VaultMedia)
    .sort((a, b) => b.createdAt - a.createdAt);
  saveCache(media);
  return media;
}
export async function deleteVaultMedia(id: string) {
  await ensureAuthenticated();
  const document = doc(db, "vault", id);
  const snapshot = await getDoc(document);
  if (!snapshot.exists()) return;
  const item = snapshot.data() as VaultMedia;
  if (item.storagePath) {
    try {
      await deleteObject(ref(storage, item.storagePath));
    } catch (error) {
      if ((error as { code?: string }).code !== "storage/object-not-found")
        throw error;
    }
  }
  await deleteDoc(document);
}
export async function getMediaBlobUrl(id: string): Promise<string | null> {
  await ensureAuthenticated();
  const item = await getDoc(doc(db, "vault", id));
  return item.exists() ? item.data().url : null;
}
