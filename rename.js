import fs from 'fs';
let c = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');
c = c.replace(/showReactionsFor/g, 'activeMessageMenu');
c = c.replace(/setShowReactionsFor/g, 'setActiveMessageMenu');
fs.writeFileSync('src/components/DiscreteChat.tsx', c);
