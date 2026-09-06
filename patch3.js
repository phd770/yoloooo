import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\s*\}, \[\]\);[^]*?\}\n  \};\n/g;
const fixed = `\n  };\n`;
content = content.replace(regex, fixed);

fs.writeFileSync(file, content);
