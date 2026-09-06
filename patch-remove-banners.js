import fs from 'fs';

// Patch DiscreteChat
let chat = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');
const chatBannerRegex = /\{\s*myTurnGames\.length\s*>\s*0[\s\S]*?<\/div>\s*\}/m;
chat = chat.replace(chatBannerRegex, '');
fs.writeFileSync('src/components/DiscreteChat.tsx', chat);

// Patch Layout
let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
const layoutBannerRegex = /\{\s*hasGameTurn\s*&&\s*activeTab\s*!==\s*'games'[\s\S]*?<\/div>\s*\}/m;
layout = layout.replace(layoutBannerRegex, '');

layout = layout.replace(
  '<span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#FF6B6B] rounded-full border-2 border-white shadow-sm"></span>',
  '<span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] bg-[#FF6B6B] rounded-full text-[10px] flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">{myTurnGames.length}</span>'
);

fs.writeFileSync('src/components/Layout.tsx', layout);
console.log("Success removing banners");
