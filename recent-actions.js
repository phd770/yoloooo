import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const msgsSnap = await getDocs(query(collection(db, 'chat_messages'), orderBy('createdAt', 'desc'), limit(5)));
  console.log("Recent chat:");
  msgsSnap.forEach(d => console.log(d.data().senderId, d.data().text, new Date(d.data().createdAt).toISOString()));

  const missionsSnap = await getDocs(query(collection(db, 'missions'), orderBy('createdAt', 'desc'), limit(5)));
  console.log("Recent missions:");
  missionsSnap.forEach(d => console.log(d.data().title, d.data().status));
  process.exit(0);
}
run();
