import fs from 'fs';
let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const mainClass = "className={`flex-1 flex flex-col w-full h-full relative transition-all duration-300 ${activeTab === 'vault' ? 'overflow-hidden pb-0' : activeTab === 'chat' ? `overflow-hidden ${isKeyboardOpen || !isChatAtBottom ? 'pb-0' : 'pb-[90px]'}` : `overflow-y-auto ${isKeyboardOpen ? '' : 'pb-[90px]'}`}`}";
const newMainClass = "className={`flex-1 flex flex-col w-full h-full relative transition-all duration-300 ${activeTab === 'vault' ? 'overflow-hidden pb-0' : activeTab === 'chat' ? 'overflow-hidden pb-0' : `overflow-y-auto ${isKeyboardOpen ? '' : 'pb-[90px]'}`}`}";

layout = layout.replace(mainClass, newMainClass);

fs.writeFileSync('src/components/Layout.tsx', layout);
console.log("Success patching Layout main");
