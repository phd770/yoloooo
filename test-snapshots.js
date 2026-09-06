import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDoc, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const qChatMessages = query(collection(db, 'chat_messages'), orderBy('createdAt', 'desc'), limit(100));
const unsubChatMessages = onSnapshot(qChatMessages, () => console.log('Chat messages OK'), (err) => console.log('Chat msgs error', err));

const qMissions = query(collection(db, 'missions'), orderBy('createdAt', 'desc'), limit(50));
const unsubMissions = onSnapshot(qMissions, () => console.log('Missions OK'), (err) => console.log('Missions error', err));

setTimeout(() => {
  unsubChatMessages();
  unsubMissions();
  process.exit(0);
}, 3000);
