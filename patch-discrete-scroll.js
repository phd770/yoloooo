import fs from 'fs';
let chat = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');

const scrollLogic = `  // Keep track of whether user is near the bottom
  const handleScroll = () => {
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

chat = chat.replace(scrollLogic, newScrollLogic);

// We need to pass isAtBottom (which now means isMenuVisible) to Layout
// Wait, if it's true (show menu), the menu will cover the input unless we pad the input!
// Let's add padding to the form if menu is visible!
const formStart = `<form onSubmit={handleSend} className="flex items-end gap-2 bg-white p-1 pb-2">`;
const newFormStart = `<form onSubmit={handleSend} className={\`flex items-end gap-2 bg-white p-1 transition-all duration-300 \${isAtBottom ? 'pb-[90px]' : 'pb-2'}\`}>`;

chat = chat.replace(formStart, newFormStart);

fs.writeFileSync('src/components/DiscreteChat.tsx', chat);
console.log("Success patching scroll logic");
