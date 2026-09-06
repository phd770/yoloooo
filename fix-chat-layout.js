import fs from 'fs';

// 1. Remove the menu from Layout when in chat
let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const mainClassRegex = /className=\{\`flex-1 flex flex-col w-full h-full relative transition-all duration-300 \$\{activeTab === 'vault' \? 'overflow-hidden pb-0' \: activeTab === 'chat' \? 'overflow-hidden pb-0' \: \`overflow-y-auto \$\{isKeyboardOpen \? '' \: 'pb-\[90px\]'\}\`\}\`\}/g;
layout = layout.replace(mainClassRegex, "className={`flex-1 flex flex-col w-full h-full relative ${(activeTab === 'chat' || activeTab === 'vault') ? 'overflow-hidden pb-0' : `overflow-y-auto ${isKeyboardOpen ? '' : 'pb-[90px]'}`}`}");

const menuRegex = /\{\!isKeyboardOpen && \(\s*<div className=\{\`fixed bottom-6[^\}]+\}\`\>/g;
layout = layout.replace(menuRegex, "{!isKeyboardOpen && activeTab !== 'chat' && (\n        <div className=\"fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] bg-white/95 backdrop-blur-xl border border-[#e2e8f0] rounded-[32px] px-2 py-2 flex justify-around items-center z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hide-scrollbar\">");

// Remove the event listener for isChatAtBottom since we don't need it
const layoutTop = `export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { missions, currentUser, chatMessages, partner } = useApp();
  
  const [isChatAtBottom, setIsChatAtBottom] = useState(true);

  useEffect(() => {
    const handleChatScroll = (e: any) => setIsChatAtBottom(e.detail.isAtBottom);
    window.addEventListener('chatScroll', handleChatScroll);
    return () => window.removeEventListener('chatScroll', handleChatScroll);
  }, []);`;

const newLayoutTop = `export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { missions, currentUser, chatMessages, partner } = useApp();`;

layout = layout.replace(layoutTop, newLayoutTop);

fs.writeFileSync('src/components/Layout.tsx', layout);
console.log("Success patching Layout");

// 2. Fix DiscreteChat
let chat = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');

// Remove the scroll direction logic and restore distance-to-bottom logic
const newScrollLogic = `  const lastScrollTopRef = useRef(0);
  
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const currentScroll = el.scrollTop;
    const scrollingDown = currentScroll > lastScrollTopRef.current;
    lastScrollTopRef.current = currentScroll;
    
    const distanceToBottom = el.scrollHeight - currentScroll - el.clientHeight;
    const atBottom = distanceToBottom < 80;
    isAtBottomRef.current = atBottom;
    
    // Instead of distance to bottom for the menu, let's use scroll direction!
    // But wait, if we dispatch an event, we need to pass if we want the menu visible.
    // Let's just say the menu is visible if scrolling DOWN or at bottom?
    // User: "שהתפריט יופיע שאני בצאט רק שאנ יגולל למטה שוב כמו שהיה פעם"
    // "only when I scroll down again"
    if (scrollingDown) {
      setIsAtBottom(true); // show menu
    } else if (currentScroll < lastScrollTopRef.current - 5) {
      setIsAtBottom(false); // hide menu when scrolling up
    }
  };`;

const originalScrollLogic = `  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceToBottom < 80;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  };`;

chat = chat.replace(newScrollLogic, originalScrollLogic);

// Remove the window dispatch event
const dispatchEvent = `  useEffect(() => {
    window.dispatchEvent(new CustomEvent('chatScroll', { detail: { isAtBottom } }));
    return () => window.dispatchEvent(new CustomEvent('chatScroll', { detail: { isAtBottom: true } }));
  }, [isAtBottom]);`;

chat = chat.replace(dispatchEvent, "");

// Fix the form padding back to original
const newFormStart = /<form onSubmit=\{handleSend\} className=\{\`flex items-end gap-2 bg-white p-1 transition-all duration-300 \$\{isAtBottom \? 'pb-\[90px\]' : 'pb-2'\}\`\}>/g;
chat = chat.replace(newFormStart, '<form onSubmit={handleSend} className="flex items-end gap-2 bg-white p-1 pb-2">');

fs.writeFileSync('src/components/DiscreteChat.tsx', chat);
console.log("Success patching DiscreteChat");
