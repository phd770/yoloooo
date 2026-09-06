import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const snap = await getDocs(collection(db, 'games'));
    console.log("Games items count: " + snap.docs.length);
    snap.docs.forEach(d => console.log(d.id, JSON.stringify(d.data()).substring(0, 50)));
    process.exit(0);
  } catch (e) {
    console.log("Firestore error: " + e.message);
    process.exit(1);
  }
}
run();
