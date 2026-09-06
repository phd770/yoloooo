import fs from 'fs';

let chat = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');

const target = "  const [myTurnGames, setMyTurnGames] = useState<{id: string, name: string}[]>([]);";
const replacement = `  useEffect(() => {
    window.dispatchEvent(new CustomEvent('chatScroll', { detail: { isAtBottom } }));
    return () => window.dispatchEvent(new CustomEvent('chatScroll', { detail: { isAtBottom: true } }));
  }, [isAtBottom]);

  const [myTurnGames, setMyTurnGames] = useState<{id: string, name: string}[]>([]);`;

chat = chat.replace(target, replacement);
fs.writeFileSync('src/components/DiscreteChat.tsx', chat);

let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const layoutTop = `export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { missions, currentUser, chatMessages, partner } = useApp();
  
  const [isChatAtBottom, setIsChatAtBottom] = useState(true);

  useEffect(() => {
    const handleChatScroll = (e: any) => setIsChatAtBottom(e.detail.isAtBottom);
    window.addEventListener('chatScroll', handleChatScroll);
    return () => window.removeEventListener('chatScroll', handleChatScroll);
  }, []);`;

layout = layout.replace(
  "export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {\n  const { missions, currentUser, chatMessages, partner } = useApp();",
  layoutTop
);

const mainClass = "className={`flex-1 flex flex-col w-full h-full relative ${activeTab === 'vault' ? 'overflow-hidden pb-0' : activeTab === 'chat' ? `overflow-hidden ${isKeyboardOpen ? 'pb-0' : 'pb-[90px]'}` : `overflow-y-auto ${isKeyboardOpen ? '' : 'pb-[90px]'}`}`}";
const newMainClass = "className={`flex-1 flex flex-col w-full h-full relative transition-all duration-300 ${activeTab === 'vault' ? 'overflow-hidden pb-0' : activeTab === 'chat' ? `overflow-hidden ${isKeyboardOpen || !isChatAtBottom ? 'pb-0' : 'pb-[90px]'}` : `overflow-y-auto ${isKeyboardOpen ? '' : 'pb-[90px]'}`}`}";

layout = layout.replace(mainClass, newMainClass);

const menuStart = `{!isKeyboardOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] bg-white/95 backdrop-blur-xl border border-[#e2e8f0] rounded-[32px] px-2 py-2 flex justify-around items-center z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]  hide-scrollbar">`;

const newMenuStart = `{!isKeyboardOpen && (
        <div className={\`fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] bg-white/95 backdrop-blur-xl border border-[#e2e8f0] rounded-[32px] px-2 py-2 flex justify-around items-center z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hide-scrollbar transition-all duration-300 \${activeTab === 'chat' && !isChatAtBottom ? 'translate-y-32 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}\`}>`;

layout = layout.replace(menuStart, newMenuStart);

const bannerStart = `{hasGameTurn && activeTab !== 'games' && !isKeyboardOpen && (
        <div 
          onClick={() => { playSound('click'); setActiveTab('games'); }}
          className="fixed bottom-[100px] left-1/2 -translate-x-1/2 bg-blue-600/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full shadow-lg z-40 flex items-center gap-2 cursor-pointer animate-bounce whitespace-nowrap"
        >`;

const newBannerStart = `{hasGameTurn && activeTab !== 'games' && !isKeyboardOpen && (
        <div 
          onClick={() => { playSound('click'); setActiveTab('games'); }}
          className={\`fixed left-1/2 -translate-x-1/2 bg-blue-600/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full shadow-lg z-40 flex items-center gap-2 cursor-pointer transition-all duration-300 whitespace-nowrap \${activeTab === 'chat' && !isChatAtBottom ? 'bottom-6' : 'bottom-[100px] animate-bounce'}\`}
        >`;

layout = layout.replace(bannerStart, newBannerStart);

fs.writeFileSync('src/components/Layout.tsx', layout);
console.log("Success");
