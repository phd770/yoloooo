import fs from 'fs';
let content = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');
content = content.replace(/\\n/g, '\n');
fs.writeFileSync('src/components/DiscreteChat.tsx', content);
console.log("Fixed newlines");
