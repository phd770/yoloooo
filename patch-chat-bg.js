import fs from 'fs';
let content = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');

content = content.replace(
  'className={`flex flex-col h-full w-full bg-white relative overflow-x-hidden pb-0`}',
  'className={`flex flex-col h-full w-full bg-slate-50 relative overflow-x-hidden pb-0`}'
);

content = content.replace(
  'className="touch-pan-y flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 flex flex-col items-stretch bg-white overscroll-contain"',
  'className="touch-pan-y flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 flex flex-col items-stretch bg-transparent overscroll-contain relative z-10"'
);

content = content.replace(
  '{/* Messages */}',
  `{/* Chat Background */}
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}></div>
        {/* Messages */}`
);

fs.writeFileSync('src/components/DiscreteChat.tsx', content);
console.log("Success patching chat background");
