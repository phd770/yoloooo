import fs from 'fs';
let content = fs.readFileSync('src/components/DiscreteChat.tsx', 'utf8');

const importStart = `import { ShieldAlert, Clock, Send, Image as ImageIcon, X, Trash2, Shield, EyeOff, Eye, Flame, Camera, Check, CheckCheck, HelpCircle, Reply, FolderLock, Baby , Edit2, MapPin, Mic, Square, Smile, ChevronRight, Video, Phone, Info, Gamepad2 } from 'lucide-react';`;

const afterImport = `import { ShieldAlert, Clock, Send, Image as ImageIcon, X, Trash2, Shield, EyeOff, Eye, Flame, Camera, Check, CheckCheck, HelpCircle, Reply, FolderLock, Baby , Edit2, MapPin, Mic, Square, Smile, ChevronRight, Video, Phone, Info, Gamepad2 } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';`;

content = content.replace(importStart, afterImport);

const hookStart = `  const isAtBottomRef = useRef(true);`;

const hookEnd = `  const isAtBottomRef = useRef(true);

  const [myTurnGames, setMyTurnGames] = useState<{id: string, name: string}[]>([]);
  useEffect(() => {
    const gameId = currentUser?.id && partner?.id ? [currentUser.id, partner.id].sort().join("_") : null;
    if (!gameId || !currentUser) return;

    const gamesList = [
      { id: \`tictactoe_\${gameId}\`, name: 'איקס עיגול' },
      { id: \`connect4_\${gameId}\`, name: 'ארבע בשורה' },
      { id: \`dotsandboxes_\${gameId}\`, name: 'קווים וריבועים' },
      { id: \`backgammon_\${gameId}\`, name: 'שש בש' }
    ];

    const unsubs = gamesList.map(g => 
      onSnapshot(doc(db, "games", g.id), (snap) => {
        const data = snap.data();
        let isMyTurn = false;
        if (data) {
          if (g.name === 'ארבע בשורה') {
            const myColor = data?.players?.R === currentUser.id ? "R" : data?.players?.Y === currentUser.id ? "Y" : null;
            isMyTurn = data.status === 'active' && data.currentTurn === myColor;
          } else {
            isMyTurn = (data.status === 'playing' || data.status === 'active') && data.turn === currentUser.id;
          }
        }
        setMyTurnGames(prev => {
          const others = prev.filter(p => p.name !== g.name);
          if (isMyTurn) return [...others, g];
          return others;
        });
      }, () => {})
    );
    return () => unsubs.forEach(u => u());
  }, [currentUser, partner]);`;

content = content.replace(hookStart, hookEnd);

const formStart = `<form onSubmit={handleSend} className="flex items-end gap-2 bg-white p-1 pb-2">`;
const newForm = `{myTurnGames.length > 0 && onNavigate && (
  <div 
    onClick={() => onNavigate('games')}
    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-blue-600 text-white px-4 py-1.5 rounded-full shadow-lg z-50 flex items-center gap-2 cursor-pointer animate-bounce whitespace-nowrap"
  >
    <Gamepad2 size={16} />
    <span className="text-xs font-bold">תורך לשחק ({myTurnGames.map(g => g.name).join(', ')})</span>
  </div>
)}
          <form onSubmit={handleSend} className="flex items-end gap-2 bg-white p-1 pb-2">`;

content = content.replace(formStart, newForm);

fs.writeFileSync('src/components/DiscreteChat.tsx', content);
console.log("Success patching chat banner");
