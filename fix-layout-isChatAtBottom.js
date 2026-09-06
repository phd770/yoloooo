import fs from 'fs';
let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const regex = /className=\{\`fixed bottom-6 left-1\/2 -translate-x-1\/2 w-\[94\%\] max-w-\[450px\] bg-white\/95 backdrop-blur-xl border border-\[\#e2e8f0\] rounded-\[32px\] px-2 py-2 flex justify-around items-center z-50 shadow-\[0_8px_30px_rgb\(0,0,0,0\.12\)\] hide-scrollbar transition-all duration-300 \$\{activeTab === 'chat' \&\& \!isChatAtBottom \? 'translate-y-32 opacity-0 pointer-events-none' \: 'translate-y-0 opacity-100'\}\`\}/g;

layout = layout.replace(regex, 'className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] bg-white/95 backdrop-blur-xl border border-[#e2e8f0] rounded-[32px] px-2 py-2 flex justify-around items-center z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hide-scrollbar"');

fs.writeFileSync('src/components/Layout.tsx', layout);
console.log("Success fixing Layout isChatAtBottom");
