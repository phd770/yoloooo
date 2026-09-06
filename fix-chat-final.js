import fs from 'fs';

// 1. Fix Layout.tsx: Remove menu from chat
let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const oldMenu = "className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] bg-white/95 backdrop-blur-xl border border-[#e2e8f0] rounded-[32px] px-2 py-2 flex justify-around items-center z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hide-scrollbar transition-all duration-300 ${activeTab === 'chat' && !isChatAtBottom ? 'translate-y-32 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}";

const newMenu = "className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[450px] bg-white/95 backdrop-blur-xl border border-[#e2e8f0] rounded-[32px] px-2 py-2 flex justify-around items-center z-50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hide-scrollbar transition-all duration-300 ${activeTab === 'chat' ? 'translate-y-32 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}";

layout = layout.replace(oldMenu, newMenu);
fs.writeFileSync('src/components/Layout.tsx', layout);
console.log("Success patching Layout");


// 2. Fix DiscreteChat.tsx: Constant padding
let chat = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');

const formStart = /<form onSubmit=\{handleSend\} className=\{\`flex items-end gap-2 bg-white p-1 transition-all duration-300 \$\{isAtBottom \&\& \!isKeyboardOpen \? 'pb-\[90px\]' : 'pb-6 md:pb-2'\}\`\}>/g;

chat = chat.replace(formStart, '<form onSubmit={handleSend} className="flex items-end gap-2 bg-white p-1 pb-6 md:pb-4">');

// Remove isKeyboardOpen logic from DiscreteChat to prevent any re-renders jumping
const keyboardLogic = `  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsKeyboardOpen(true);
      }
    };
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          if (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
            setIsKeyboardOpen(false);
          }
        }, 50);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);`;

chat = chat.replace(keyboardLogic, '');

fs.writeFileSync('src/components/DiscreteChat.tsx', chat);
console.log("Success patching DiscreteChat");
