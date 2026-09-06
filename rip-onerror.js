import fs from 'fs';

const files = [
  'src/components/Games.tsx',
  'src/components/ConnectFour.tsx',
  'src/components/Backgammon.tsx',
  'src/lib/store.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // This regex matches `, (error) => { ... }` block
  // Because the block has nested braces, it's tricky to write a simple regex.
  // Instead, let's just do it programmatically by looking for `, (error) => {`
  
  let parts = content.split(', (error) => {');
  let newContent = parts[0];
  
  for (let i = 1; i < parts.length; i++) {
    let part = parts[i];
    let openBraces = 1;
    let j = 0;
    while (openBraces > 0 && j < part.length) {
      if (part[j] === '{') openBraces++;
      if (part[j] === '}') openBraces--;
      j++;
    }
    // We also need to remove any trailing `);` that might be right after the closing brace if the callback was the last argument.
    // Wait, onSnapshot ends with `);` 
    // The original code was: `}, (error) => { ... });`
    // So if we remove `, (error) => { ... }`, we need to make sure we don't remove `);`
    // Actually, `j` is the index right after the closing brace of the error handler.
    let remainder = part.substring(j);
    newContent += remainder;
  }

  fs.writeFileSync(file, newContent);
}
