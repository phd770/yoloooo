import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    await setDoc(doc(db, 'games', 'test'), { test: 1 });
    console.log("Firestore games collection OK.");
  } catch (e) {
    console.log("Firestore error: " + e.message);
  }
}
run();
