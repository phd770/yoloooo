import fs from 'fs';
const file = 'src/components/DiscreteChat.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("sendMessage,", "editMessage,\n    sendMessage,");

content = content.replace(
  "const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);",
  "const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);\n  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);"
);

fs.writeFileSync(file, content);
