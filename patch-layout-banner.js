import fs from 'fs';
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const navStart = `      {!isKeyboardOpen && activeTab !== 'chat' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] bg-white/95 backdrop-blur-xl border border-[#e2e8f0] rounded-[32px] px-2 py-2 flex justify-around items-center z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]  hide-scrollbar">`;

const withBanner = `      {hasGameTurn && activeTab !== 'games' && !isKeyboardOpen && activeTab !== 'chat' && (
        <div 
          onClick={() => { playSound('click'); setActiveTab('games'); }}
          className="fixed bottom-[100px] left-1/2 -translate-x-1/2 bg-blue-600/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full shadow-lg z-40 flex items-center gap-2 cursor-pointer animate-bounce whitespace-nowrap"
        >
          <Gamepad2 size={18} />
          <span className="text-sm font-bold">תורך לשחק ({myTurnGames.map(g => g.name).join(', ')})</span>
        </div>
      )}

      {!isKeyboardOpen && activeTab !== 'chat' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] bg-white/95 backdrop-blur-xl border border-[#e2e8f0] rounded-[32px] px-2 py-2 flex justify-around items-center z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]  hide-scrollbar">`;

content = content.replace(navStart, withBanner);
fs.writeFileSync('src/components/Layout.tsx', content);
console.log("Success patching layout banner");
