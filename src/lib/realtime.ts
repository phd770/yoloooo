import {
  onSnapshot,
  runTransaction,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type FirestoreError,
} from "firebase/firestore";
import { db } from "../firebase";
import { subscribeWithRecovery } from "./subscription";

export function observeDocument(
  reference: DocumentReference<DocumentData>,
  receive: (snapshot: DocumentSnapshot<DocumentData>) => void,
  onError: (error: FirestoreError) => void = (error) =>
    console.error("[sync] Document unavailable", error.code),
) {
  return subscribeWithRecovery(
    (ready, failed) =>
      onSnapshot(
        reference,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!snapshot.metadata.fromCache) ready();
          receive(snapshot);
        },
        failed,
      ),
    (error) => onError(error as FirestoreError),
    () => {},
  );
}

export async function createDocumentIfMissing(
  reference: DocumentReference,
  data: DocumentData,
) {
  return runTransaction(db, async (transaction) => {
    if ((await transaction.get(reference)).exists()) return false;
    transaction.set(reference, data);
    return true;
  });
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableValue((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
/** Reject a stale move instead of overwriting a move from another device. */
export async function updateDocumentIfUnchanged(
  reference: DocumentReference,
  expected: Record<string, any>,
  patch: Record<string, any>,
  fields: string[],
) {
  if (!navigator.onLine) throw new Error("אין חיבור לאינטרנט");
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (
      !snapshot.exists() ||
      fields.some(
        (key) =>
          stableValue(snapshot.data()[key]) !== stableValue(expected[key]),
      )
    )
      throw new Error("הלוח השתנה. נסו שוב עם הלוח המעודכן.");
    transaction.update(reference, patch);
  });
}
