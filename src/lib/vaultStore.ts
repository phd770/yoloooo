import { authReady, db, storage } from '../firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

interface VaultMedia {
  id: string;
  type: 'image' | 'video';
  name: string;
  storagePath: string;
  url: string;
  thumbnail?: string | null;
  createdAt: number;
}

const LOCAL_STORAGE_KEY = 'dateapp_local_vault';
const MAX_MEDIA_SIZE = 50 * 1024 * 1024;

function sanitizeStorageName(name: string): string {
  const safeName = name.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return safeName || 'media';
}

function getLocalVault(): VaultMedia[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalVault(vault: VaultMedia[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(vault));
  } catch (e) {
    console.error("Failed saving vault locally", e);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function addMediaToVault(
  type: 'image' | 'video',
  name: string,
  data: Blob,
  thumbnail?: string
): Promise<string> {
  if (data.size > MAX_MEDIA_SIZE) {
    throw new Error('Media file exceeds the 50 MB limit');
  }

  const id = crypto.randomUUID();
  const storagePath = `vault/${id}-${sanitizeStorageName(name)}`;
  const isOffline = false;
  let downloadURL = '';

  if (!isOffline) {
    try {
      await authReady;
      // 1. Upload to Cloud Storage
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, data);
      downloadURL = await getDownloadURL(storageRef);
    } catch (e) {
      console.warn("Storage upload failed, falling back to base64", e);
      // Fallback
      downloadURL = await blobToBase64(data);
    }
  } else {
    downloadURL = await blobToBase64(data);
  }

  const mediaData: VaultMedia = {
    id,
    type,
    name,
    storagePath: downloadURL.startsWith('data:') ? '' : storagePath,
    url: downloadURL,
    thumbnail: thumbnail || null,
    createdAt: Date.now(),
  };

  if (!isOffline && downloadURL.startsWith('data:') && downloadURL.length < 1000000) {
     // If it's small enough, try storing it in Firestore as a fallback
     try {
       await setDoc(doc(db, 'vault', id), mediaData);
       return id;
     } catch (e) {
       console.warn("Firestore save failed, saving locally", e);
     }
  } else if (!isOffline && !downloadURL.startsWith('data:')) {
     try {
       await setDoc(doc(db, 'vault', id), mediaData);
       return id;
     } catch (e) {
       console.warn("Firestore save failed, saving locally", e);
     }
  }

  // Pure local fallback
  const localVault = getLocalVault();
  localVault.push(mediaData);
  saveLocalVault(localVault);
  
  return id;
}

export async function addUrlToVault(
  type: 'image' | 'video',
  name: string,
  url: string,
  thumbnail?: string
): Promise<string> {
  const id = crypto.randomUUID();
  const isOffline = false;

  const mediaData: VaultMedia = {
    id,
    type,
    name,
    storagePath: '', // For remote URLs, we don't have a direct storage path reference necessarily
    url,
    thumbnail: thumbnail || null,
    createdAt: Date.now(),
  };

  if (!isOffline) {
     try {
       await authReady;
       await setDoc(doc(db, 'vault', id), mediaData);
       return id;
     } catch (e) {
       console.warn("Firestore save failed, saving locally", e);
     }
  }

  // Pure local fallback
  const localVault = getLocalVault();
  localVault.push(mediaData);
  saveLocalVault(localVault);
  
  return id;
}

export async function getVaultMedia(): Promise<VaultMedia[]> {
  let remoteDocs: VaultMedia[] = [];
  
  try {
    await authReady;
    const q = query(collection(db, 'vault'));
    const snapshot = await getDocs(q);
    remoteDocs = snapshot.docs.map(doc => doc.data() as VaultMedia);
  } catch (e) {
    console.warn("Failed fetching from Firestore, falling back to local vault");
  }

  const localDocs = getLocalVault();
  
  // Merge remote and local (avoiding duplicates if somehow they exist in both)
  const allDocsMap = new Map<string, VaultMedia>();
  remoteDocs.forEach(d => allDocsMap.set(d.id, d));
  localDocs.forEach(d => allDocsMap.set(d.id, d));
  
  const docs = Array.from(allDocsMap.values());
  return docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function deleteVaultMedia(id: string) {
  const isOffline = false;

  let foundDoc: VaultMedia | undefined;
  
  if (!isOffline) {
    try {
      await authReady;
      const snapshot = await getDocs(query(collection(db, 'vault')));
      foundDoc = snapshot.docs.find(d => d.id === id)?.data() as VaultMedia;
      
      if (foundDoc && foundDoc.storagePath) {
        try {
          const storageRef = ref(storage, foundDoc.storagePath);
          await deleteObject(storageRef);
        } catch (e) {
          console.warn("Could not delete from storage, might already be deleted", e);
        }
      }
      await deleteDoc(doc(db, 'vault', id));
    } catch (e) {}
  }

  // Delete from local as well
  let localVault = getLocalVault();
  localVault = localVault.filter(d => d.id !== id);
  saveLocalVault(localVault);
}

export async function getMediaBlobUrl(id: string): Promise<string | null> {
  const docs = await getVaultMedia();
  const docData = docs.find(d => d.id === id);
  return docData ? docData.url : null;
}
