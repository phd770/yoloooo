import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');

const regexScroll = /      if \\(isInitialLoad \\|\\| isNearBottom \\|\\| isMyMessage\\) \\{\\n        scroll\\(\\);\\n        setTimeout\\(scroll, 100\\);\\n      \\}/;

content = content.replace(regexScroll, `      if (isInitialLoad || isMyMessage) {
        scroll();
        setTimeout(scroll, 100);
      }`);

fs.writeFileSync(file, content);
