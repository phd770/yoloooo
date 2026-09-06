import fs from 'fs';
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');
console.log(content.match(/className="fixed bottom-6[^"]+"/));
