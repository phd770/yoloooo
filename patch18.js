import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `      if (isInitialLoad || isNearBottom || isMyMessage) {
        scroll();
        setTimeout(scroll, 100);
      }`,
  `      if (isInitialLoad || isMyMessage) {
        scroll();
        setTimeout(scroll, 100);
      } else if (isNearBottom) {
        scroll();
      }`
);

fs.writeFileSync(file, content);
