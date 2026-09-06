import fs from 'fs';

// Fix DiscreteChat
let chat = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');
chat = chat.replace("from '../lib/firebase';", "from '../firebase';");
fs.writeFileSync('src/components/DiscreteChat.tsx', chat);

// Fix Games.tsx
let games = fs.readFileSync('src/components/Games.tsx', 'utf8');
games = games.replace("} else if (!docSnap.metadata.fromCache) {", "} else if (!(docSnap as any).metadata.fromCache) {");
fs.writeFileSync('src/components/Games.tsx', games);

console.log("Success patching typescript errors");
