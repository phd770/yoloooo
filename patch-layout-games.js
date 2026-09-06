import fs from 'fs';
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const oldEffect = `  useEffect(() => {
    if (!gameId || !currentUser || false) {
      setGamesWithMyTurn(0);
      return;
    }

    const unsubTtt = onSnapshot(doc(db, "games", \`tictactoe_\${gameId}\`), (snap) => {
      const data = snap.data();
      setGamesWithMyTurn(prev => {
        const isTurn = data?.status === "playing" && data?.turn === currentUser.id ? 1 : 0;
        return (prev & ~1) | isTurn;
      });
    }, () => {});

    const unsubC4 = onSnapshot(doc(db, "games", \`connect4_\${gameId}\`), (snap) => {
      const data = snap.data();
      const myColor = data?.players?.R === currentUser.id ? "R" : data?.players?.Y === currentUser.id ? "Y" : null;
      setGamesWithMyTurn(prev => {
        const isTurn = data?.status === "active" && data?.currentTurn === myColor ? 2 : 0;
        return (prev & ~2) | isTurn;
      });
    }, () => {});

    const unsubBg = onSnapshot(doc(db, "games", \`backgammon_\${gameId}\`), (snap) => {
      const data = snap.data();
      setGamesWithMyTurn(prev => {
        const isTurn = data?.status === "active" && data?.turn === currentUser.id ? 4 : 0;
        return (prev & ~4) | isTurn;
      });
    }, () => {});

    return () => {
      unsubTtt();
      unsubC4();
      unsubBg();
    };
  }, [gameId, currentUser]);

  const hasGameTurn = gamesWithMyTurn > 0;`;

const newEffect = `  const [myTurnGames, setMyTurnGames] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (!gameId || !currentUser) {
      setMyTurnGames([]);
      return;
    }

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
          if (isMyTurn) {
            return [...others, g];
          }
          return others;
        });
      }, () => {})
    );

    return () => unsubs.forEach(u => u());
  }, [gameId, currentUser]);

  const hasGameTurn = myTurnGames.length > 0;`;

content = content.replace(oldEffect, newEffect);
fs.writeFileSync('src/components/Layout.tsx', content);
console.log("Success patching layout hooks");
