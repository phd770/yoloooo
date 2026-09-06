import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const snap = await getDocs(query(collection(db, 'chat_messages'), limit(1)));
    console.log("Firestore OK. Found " + snap.docs.length + " docs.");
  } catch (e) {
    console.log("Firestore error: " + e.message);
  }
}
run();
