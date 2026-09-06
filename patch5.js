import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/className="opacity-0 group-hover:opacity-100 p-2 text-\\[#a0aec0\\] hover:text-\\[#FF6B6B\\] transition-opacity"/g, 'className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 text-[#a0aec0] hover:text-[#FF6B6B] transition-opacity"');

fs.writeFileSync(file, content);
