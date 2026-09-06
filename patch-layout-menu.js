import fs from 'fs';
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

content = content.replace(
  "{!isKeyboardOpen && activeTab !== 'chat' && (",
  "{!isKeyboardOpen && ("
);

content = content.replace(
  "{hasGameTurn && activeTab !== 'games' && !isKeyboardOpen && activeTab !== 'chat' && (",
  "{hasGameTurn && activeTab !== 'games' && !isKeyboardOpen && ("
);

fs.writeFileSync('src/components/Layout.tsx', content);
console.log("Success patching Layout menu");
