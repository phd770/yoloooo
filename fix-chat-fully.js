import fs from 'fs';

// 1. Fix Layout.tsx
let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// Restore isChatAtBottom state
const layoutTop = `export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { missions, currentUser, chatMessages, partner } = useApp();`;

const newLayoutTop = `export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { missions, currentUser, chatMessages, partner } = useApp();
  
  const [isChatAtBottom, setIsChatAtBottom] = useState(true);

  React.useEffect(() => {
    const handleChatScroll = (e: any) => setIsChatAtBottom(e.detail.isAtBottom);
    window.addEventListener('chatScroll', handleChatScroll);
    return () => window.removeEventListener('chatScroll', handleChatScroll);
  }, []);`;

layout = layout.replace(layoutTop, newLayoutTop);

// Fix main class
const mainClass = "className={`flex-1 flex flex-col w-full h-full relative ${(activeTab === 'chat' || activeTab === 'vault') ? 'overflow-hidden pb-0' : `overflow-y-auto ${isKeyboardOpen ? '' : 'pb-[90px]'}`}`}";
const newMainClass = "className={`flex-1 flex flex-col w-full h-full relative ${(activeTab === 'chat' || activeTab === 'vault') ? 'overflow-hidden pb-0' : `overflow-y-auto ${isKeyboardOpen ? '' : 'pb-[90px]'}`}`}";
// No change needed for mainClass actually, we want pb-0 for chat since chat handles its own inner scrolling.

// Fix menu
const oldMenu = `{!isKeyboardOpen && activeTab !== 'chat' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] bg-white/95 backdrop-blur-xl border border-[#e2e8f0] rounded-[32px] px-2 py-2 flex justify-around items-center z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hide-scrollbar">`;

const newMenu = `{!isKeyboardOpen && (
        <div className={\`fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] bg-white/95 backdrop-blur-xl border border-[#e2e8f0] rounded-[32px] px-2 py-2 flex justify-around items-center z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hide-scrollbar transition-all duration-300 \${activeTab === 'chat' && !isChatAtBottom ? 'translate-y-32 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}\`}>`;

layout = layout.replace(oldMenu, newMenu);

fs.writeFileSync('src/components/Layout.tsx', layout);
console.log("Success patching Layout");

// 2. Fix DiscreteChat.tsx
let chat = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');

const scrollLogic = `  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceToBottom < 80;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  };`;

const newScrollLogic = `  const lastScrollTopRef = useRef(0);
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    
    const currentScroll = el.scrollTop;
    const scrollingDown = currentScroll > lastScrollTopRef.current;
    lastScrollTopRef.current = currentScroll;
    
    const distanceToBottom = el.scrollHeight - currentScroll - el.clientHeight;
    const atBottom = distanceToBottom < 80;
    
    // Instead of actual bottom, let's use scrolling direction for menu visibility
    // If scrolling down or at bottom, show menu (isAtBottom = true)
    if (scrollingDown || atBottom) {
      isAtBottomRef.current = true;
      setIsAtBottom(true);
    } else if (currentScroll < lastScrollTopRef.current - 10) {
      isAtBottomRef.current = false;
      setIsAtBottom(false);
    }
  };
  
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('chatScroll', { detail: { isAtBottom } }));
    return () => window.dispatchEvent(new CustomEvent('chatScroll', { detail: { isAtBottom: true } }));
  }, [isAtBottom]);`;

chat = chat.replace(scrollLogic, newScrollLogic);

// Fix form padding
const formStart = `<form onSubmit={handleSend} className="flex items-end gap-2 bg-white p-1 pb-2">`;
const newFormStart = `<form onSubmit={handleSend} className={\`flex items-end gap-2 bg-white p-1 transition-all duration-300 \${isAtBottom && !isKeyboardOpen ? 'pb-[90px]' : 'pb-safe-or-2'}\`}>`;

chat = chat.replace(formStart, newFormStart.replace('pb-safe-or-2', 'pb-6 md:pb-2'));

fs.writeFileSync('src/components/DiscreteChat.tsx', chat);
console.log("Success patching DiscreteChat");

