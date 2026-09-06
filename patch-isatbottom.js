import fs from 'fs';
let content = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');

content = content.replace(
  "const isAtBottomRef = useRef(true);",
  "const isAtBottomRef = useRef(true);\\n  const [isAtBottom, setIsAtBottom] = useState(true);"
);

content = content.replace(
  "isAtBottomRef.current = distanceToBottom < 80;",
  "const atBottom = distanceToBottom < 80;\\n    isAtBottomRef.current = atBottom;\\n    setIsAtBottom(atBottom);"
);

content = content.replace(
  "{!isAtBottomRef.current && chatMessages.length > 0",
  "{!isAtBottom && chatMessages.length > 0"
);

fs.writeFileSync('src/components/DiscreteChat.tsx', content);
console.log("Success patching isAtBottom state");
