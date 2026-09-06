import fs from 'fs';
let content = fs.readFileSync('src/components/Games.tsx', 'utf8');

content = content.replace(
  `} else {
          initGame();
        }`,
  `} else if (!docSnap.metadata.fromCache) {
          initGame();
        }`
);

fs.writeFileSync('src/components/Games.tsx', content);
console.log("Success patching Games.tsx init");
