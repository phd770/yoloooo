import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replaceAll(
  'className="opacity-60 md:opacity-0 md:group-hover:opacity-100 p-2 text-[#a0aec0] hover:text-[#FF6B6B] transition-opacity"',
  'className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-3 -mx-2 text-[#a0aec0] hover:text-[#FF6B6B] active:bg-gray-100 rounded-full transition-all"'
);

fs.writeFileSync(file, content);
