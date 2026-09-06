import fs from 'fs';
const file = 'src/lib/store.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const [missions, setMissions] = useState<Mission[]>([]);",
  "const [missions, setMissions] = useState<Mission[] | null>(null);"
);

content = content.replace(
  "const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);",
  "const [chatMessages, setChatMessages] = useState<ChatMessage[] | null>(null);"
);

const toReplace = `  const activeUser = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
  const activePartner = hasQuotaError ? (currentUserId ? (localUsers || {})[currentUserId === 'mishel' ? 'boaz' : 'mishel'] : null) : partner;
  const activeMissions = hasQuotaError ? localMissions : missions;
  const activeSession = hasQuotaError ? localSession : session;
  const activeChatSession = hasQuotaError ? localChatSession : chatSession;
  const activeChatMessages = hasQuotaError ? localChatMessages : chatMessages;`;

const replacement = `  const activeUser = hasQuotaError || !currentUser ? (currentUserId ? (localUsers || {})[currentUserId] : null) : currentUser;
  const activePartner = hasQuotaError || !partner ? (currentUserId ? (localUsers || {})[currentUserId === 'mishel' ? 'boaz' : 'mishel'] : null) : partner;
  const activeMissions = hasQuotaError || missions === null ? localMissions : missions;
  const activeSession = hasQuotaError || session === null ? localSession : session;
  const activeChatSession = hasQuotaError || chatSession === null ? localChatSession : chatSession;
  const activeChatMessages = hasQuotaError || chatMessages === null ? localChatMessages : chatMessages;`;

content = content.replace(toReplace, replacement);

fs.writeFileSync(file, content);
