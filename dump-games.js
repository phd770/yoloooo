import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const ids = ['tictactoe_boaz_mishel', 'connect4_boaz_mishel', 'backgammon_boaz_mishel'];
  for (const id of ids) {
    const d = await getDoc(doc(db, 'games', id));
    console.log(id);
    console.log(JSON.stringify(d.data(), null, 2));
  }
  process.exit(0);
}
run();
