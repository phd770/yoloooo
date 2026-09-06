import fs from 'fs';
const file = 'src/lib/store.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `      setChatMessages(prev => {
        if (prev.some(m => m.id === msgId)) return prev;
        return [msgData, ...prev];
      });`,
  `      setChatMessages(prev => {
        const safePrev = prev || [];
        if (safePrev.some(m => m.id === msgId)) return safePrev;
        return [msgData, ...safePrev];
      });`
);

fs.writeFileSync(file, content);
