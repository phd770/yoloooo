import { ensureAuthenticated, getStorageLazy } from "../firebase";
export async function uploadChatMedia(file: Blob, name: string) {
  if (!/^(image|video|audio)\//.test(file.type) || !file.size)
    throw new Error("סוג הקובץ אינו נתמך");
  if (file.size >= 50 * 1024 * 1024)
    throw new Error("יש לבחור קובץ קטן מ־50 מגה");
  await ensureAuthenticated();
  const [{ ref, uploadBytes, getDownloadURL, deleteObject }, storage] =
    await Promise.all([import("firebase/storage"), getStorageLazy()]);
  const target = ref(
    storage,
    `chat/${crypto.randomUUID()}-${name.replace(/[^\w.-]/g, "_").slice(0, 80)}`,
  );
  await uploadBytes(target, file, { contentType: file.type });
  try {
    return { url: await getDownloadURL(target), path: target.fullPath };
  } catch (error) {
    await deleteObject(target).catch(() => {});
    throw error;
  }
}
