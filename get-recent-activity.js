import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  // Chat Messages
  const msgsSnap = await getDocs(query(collection(db, 'chat_messages'), orderBy('createdAt', 'desc'), limit(15)));
  console.log("--- CHAT MESSAGES ---");
  msgsSnap.forEach(d => console.log(new Date(d.data().createdAt).toISOString(), d.data().senderId, d.data().text || "[MEDIA/OTHER]"));

  // Missions
  const missionsSnap = await getDocs(query(collection(db, 'missions'), orderBy('createdAt', 'desc'), limit(15)));
  console.log("--- MISSIONS ---");
  missionsSnap.forEach(d => console.log(new Date(d.data().createdAt).toISOString(), d.data().sender, d.data().receiver, d.data().title, d.data().status));

  // Vault
  const vaultSnap = await getDocs(query(collection(db, 'vault'), orderBy('createdAt', 'desc'), limit(10)));
  console.log("--- VAULT ---");
  vaultSnap.forEach(d => console.log(new Date(d.data().createdAt).toISOString(), d.data().type, d.data().name));

  // Games
  const gamesSnap = await getDocs(collection(db, 'games'));
  console.log("--- GAMES ---");
  gamesSnap.forEach(d => {
     const data = d.data();
     if (data.updatedAt) {
        console.log(d.id, "updated at:", new Date(data.updatedAt).toISOString());
     } else if (data.lastMove && data.lastMove.at) {
        console.log(d.id, "last move at:", new Date(data.lastMove.at).toISOString());
     }
  });

  process.exit(0);
}
run();
