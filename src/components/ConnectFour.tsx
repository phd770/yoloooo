import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useApp } from "../lib/store";
import { playSound } from "../lib/sounds";
import { sendNotification, requestNotificationPermission } from "../lib/notifications";
import { toast } from "sonner";
import { Gamepad2, RotateCcw, Send, Sparkles, Trophy, Users, HelpCircle, BookOpen } from "lucide-react";

const ROWS = 6;
const COLS = 7;

type BoardCell = "R" | "Y" | null;
type BoardState = BoardCell[][];

interface GameState {
  type: string;
  board: BoardState;
  players: {
    R: string;
    Y: string | null;
  };
  playerNames: {
    R: string;
    Y: string | null;
  };
  currentTurn: "R" | "Y";
  status: "waiting" | "active" | "finished" | "draw";
  winner: "R" | "Y" | null;
  winningCells: { r: number; c: number }[];
  lastMove: {
    player: "R" | "Y";
    row: number;
    col: number;
    at: number;
  } | null;
  punishmentText?: string | null;
  scores?: {
    [userId: string]: number;
  };
}

function createEmptyBoard(): BoardState {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function serializeBoard(board: BoardState): any {
  return board.flat();
}

function deserializeBoard(flatBoard: any): BoardState {
  if (!Array.isArray(flatBoard)) {
    return createEmptyBoard();
  }
  if (flatBoard.length > 0 && Array.isArray(flatBoard[0])) {
    return flatBoard as BoardState;
  }
  const board: BoardState = [];
  for (let r = 0; r < ROWS; r++) {
    board.push(flatBoard.slice(r * COLS, (r + 1) * COLS) as BoardCell[]);
  }
  return board;
}

function checkWinner(board: BoardState, player: "R" | "Y"): { r: number; c: number }[] | null {
  const directions = [
    [0, 1],   // Horizontal
    [1, 0],   // Vertical
    [1, 1],   // Diagonal down-right
    [1, -1],  // Diagonal up-right
  ];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (board[row][col] !== player) continue;

      for (const [dr, dc] of directions) {
        const cells: { r: number; c: number }[] = [];

        for (let i = 0; i < 4; i++) {
          const r = row + dr * i;
          const c = col + dc * i;

          if (
            r < 0 ||
            r >= ROWS ||
            c < 0 ||
            c >= COLS ||
            board[r][c] !== player
          ) {
            break;
          }

          cells.push({ r, c });
        }

        if (cells.length === 4) {
          return cells;
        }
      }
    }
  }

  return null;
}

function isBoardFull(board: BoardState): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

function getAvailableRow(board: BoardState, col: number): number | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (!board[row][col]) return row;
  }
  return null;
}

export function ConnectFour() {
  const { currentUser, partner, sendMission } = useApp();
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [punishmentInput, setPunishmentInput] = useState("");
  const [punishmentSent, setPunishmentSent] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isOfflinePlay, setIsOfflinePlay] = useState(false);
  const [localGame, setLocalGame] = useState<GameState | null>(null);
  const [isMoveProcessing, setIsMoveProcessing] = useState(false);
  const processingRef = useRef(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [scoresResetLoading, setScoresResetLoading] = useState(false);
  const [punishmentSendLoading, setPunishmentSendLoading] = useState(false);

  const gameId = useMemo(() => {
    if (!currentUser?.id || !partner?.id) return null;
    return [currentUser.id, partner.id].sort().join("_");
  }, [currentUser?.id, partner?.id]);

  const gameRef = useMemo(() => {
    if (!gameId) return null;
    return doc(db, "games", `connect4_${gameId}`);
  }, [gameId]);

  const initialLocalState = useMemo<GameState | null>(() => {
    if (!currentUser || !partner) return null;
    const initialScores = {
      [currentUser.id]: 0,
      [partner.id]: 0,
    };
    return {
      type: "connect4",
      board: createEmptyBoard(),
      players: {
        R: currentUser.id,
        Y: partner.id,
      },
      playerNames: {
        R: currentUser.name,
        Y: partner.name,
      },
      currentTurn: "R",
      status: "active",
      winner: null,
      winningCells: [],
      lastMove: null,
      scores: initialScores,
    };
  }, [currentUser, partner]);

  // Load from local storage or initialize
  useEffect(() => {
    if (!initialLocalState) return;
    try {
      const saved = localStorage.getItem("dateapp_connect4_game");
      if (saved) {
        setLocalGame(JSON.parse(saved));
      } else {
        setLocalGame(initialLocalState);
      }
    } catch {
      setLocalGame(initialLocalState);
    }
  }, [initialLocalState]);

  const saveLocalGame = (nextGame: GameState) => {
    setLocalGame(nextGame);
    try {
      localStorage.setItem("dateapp_connect4_game", JSON.stringify(nextGame));
    } catch {}
  };

  const isLocalActive = false || isOfflinePlay;
  const activeGame = isLocalActive ? localGame : (game || localGame);

  useEffect(() => {
    if (isLocalActive) {
      setLoading(false);
      return;
    }

    if (false) {
      setLoading(false);
      setIsOfflinePlay(true);
      return;
    }

    if (!gameRef || !currentUser || !partner) return;

    async function initGame() {
      try {
        const snap = await getDoc(gameRef!);
        if (!snap.exists()) {
          const initialScores = {
            [currentUser!.id]: 0,
            [partner!.id]: 0,
          };

          const initData: GameState = {
            type: "connect4",
            board: createEmptyBoard(),
            players: {
              R: currentUser!.id,
              Y: partner!.id,
            },
            playerNames: {
              R: currentUser!.name,
              Y: partner!.name,
            },
            currentTurn: "R",
            status: "active",
            winner: null,
            winningCells: [],
            lastMove: null,
            scores: initialScores,
          };

          await setDoc(gameRef!, {
            ...initData,
            board: serializeBoard(initData.board),
          });
          saveLocalGame(initData);
        } else {
          const data = snap.data() as GameState;
          const currentPlayers = data.players as { R?: string; Y?: string | null } | undefined;
          const isUserR = currentPlayers?.R === currentUser!.id;
          const isUserY = currentPlayers?.Y === currentUser!.id;
          const isPartnerR = currentPlayers?.R === partner!.id;
          const isPartnerY = currentPlayers?.Y === partner!.id;

          const needsHeal = !data.scores || 
                            !currentPlayers?.R || 
                            !currentPlayers?.Y || 
                            !(isUserR || isUserY) || 
                            !(isPartnerR || isPartnerY);

          if (needsHeal) {
            const healedPlayers = {
              R: isUserR || (!isUserY && !isPartnerR) ? currentUser!.id : partner!.id,
              Y: isPartnerY || (!isPartnerR && !isUserY) ? partner!.id : (currentUser!.id === currentPlayers?.R ? partner!.id : currentUser!.id),
            };

            if (healedPlayers.R === healedPlayers.Y) {
              healedPlayers.R = currentUser!.id;
              healedPlayers.Y = partner!.id;
            }

            const healedScores = data.scores || {
              [currentUser!.id]: 0,
              [partner!.id]: 0,
            };

            const healedData = {
              players: healedPlayers,
              playerNames: {
                R: healedPlayers.R === currentUser!.id ? currentUser!.name : partner!.name,
                Y: healedPlayers.Y === currentUser!.id ? currentUser!.name : partner!.name,
              },
              scores: healedScores,
              status: data.status === "waiting" ? "active" : data.status,
            };

            await updateDoc(gameRef!, healedData);
          }
        }
      } catch (e) {
        console.error("Failed to initialize Connect 4 in Firestore:", e);
        setIsOfflinePlay(true);
      }
    }

    initGame();

    const unsubscribe = onSnapshot(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as GameState;
        if (data && data.board) {
          data.board = deserializeBoard(data.board);
        }
        setGame(data);
        saveLocalGame(data);
        setLoading(false);
      }
    }, (error: any) => {
      const errMsg = String(error.message || error).toLowerCase();
      if (errMsg.includes('quota') || errMsg.includes('exhausted') || error.code === 'resource-exhausted' || error.code === 'unavailable' || errMsg.includes('offline')) {
        console.warn("Quota or connection error, working offline (ConnectFour snapshot)");
      } else {
        console.error("Connect Four onSnapshot error:", error);
      }
      setIsOfflinePlay(true);
    });

    return () => unsubscribe();
  }, [gameRef, currentUser, partner, isLocalActive]);

  const myColor = useMemo(() => {
    if (!activeGame || !currentUser?.id) return null;
    if (activeGame.players?.R === currentUser.id) return "R";
    if (activeGame.players?.Y === currentUser.id) return "Y";
    return null;
  }, [activeGame, currentUser?.id]);

  const opponentColor = myColor === "R" ? "Y" : "R";

  const colorName = {
    R: "אדום",
    Y: "צהוב",
  };

  const isMyTurn = activeGame?.currentTurn === myColor && activeGame?.status === "active";

  useEffect(() => {
    if (isMyTurn) {
      toast.info("תורך לשחק בארבע בשורה! 🔵🔴", {
        description: "שימו לב לצבע שלכם...",
        duration: 3000,
      });
      playSound('success');
      sendNotification("תורך לשחק בארבע בשורה! 🔵🔴", { body: "שימו לב לצבע שלכם..." });
    }
  }, [isMyTurn]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  async function handleColumnClick(col: number) {
    if (!currentUser?.id || !activeGame || isMoveProcessing || processingRef.current) return;

    processingRef.current = true;
    setIsMoveProcessing(true);

    const playerColor =
      activeGame.players?.R === currentUser.id
        ? "R"
        : activeGame.players?.Y === currentUser.id
        ? "Y"
        : null;

    if (!playerColor) {
      setMessage("אינך אחד מהשחקנים הרשומים למשחק.");
      setIsMoveProcessing(false);
      processingRef.current = false;
      return;
    }

    if (activeGame.status !== "active") {
      setMessage("המשחק אינו פעיל או שכבר הסתיים.");
      setIsMoveProcessing(false);
      processingRef.current = false;
      return;
    }

    if (activeGame.currentTurn !== playerColor && !isLocalActive) {
      setMessage("זהו לא התור שלך כעת.");
      setIsMoveProcessing(false);
      processingRef.current = false;
      return;
    }

    const row = getAvailableRow(activeGame.board, col);
    if (row === null) {
      setMessage("הטור הזה מלא, בחר טור אחר.");
      setIsMoveProcessing(false);
      processingRef.current = false;
      return;
    }

    playSound("click");

    const activeColor = isLocalActive ? activeGame.currentTurn : playerColor;
    const newBoard = activeGame.board.map((r) => [...r]);
    newBoard[row][col] = activeColor;

    const winningCells = checkWinner(newBoard, activeColor);
    const draw = isBoardFull(newBoard);

    const nextTurn = activeColor === "R" ? "Y" : "R";
    const gameScores = { ...(activeGame.scores || {}) };
    const activeMoverId = activeGame.players[activeColor] || currentUser.id;

    if (winningCells) {
      gameScores[activeMoverId] = (gameScores[activeMoverId] || 0) + 1;
    }

    const updatedGame: GameState = {
      ...activeGame,
      board: newBoard,
      currentTurn: winningCells || draw ? activeColor : nextTurn,
      status: winningCells ? "finished" : draw ? "draw" : "active",
      winner: winningCells ? activeColor : null,
      winningCells: winningCells || [],
      lastMove: {
        player: activeColor,
        row,
        col,
        at: Date.now(),
      },
      scores: gameScores,
    };

    const previousLocalGame = activeGame;
    saveLocalGame(updatedGame);
    setMessage("");

    if (gameRef && !isLocalActive) {
      try {
        await runTransaction(db, async (transaction) => {
          const gameDoc = await transaction.get(gameRef);
          if (!gameDoc.exists()) {
            throw new Error("Game does not exist");
          }
          const serverGame = gameDoc.data() as GameState;
          if (serverGame && serverGame.board) {
            serverGame.board = deserializeBoard(serverGame.board);
          }

          if (serverGame.status !== "active") {
            throw new Error("המשחק אינו פעיל או שכבר הסתיים.");
          }
          if (serverGame.currentTurn !== playerColor) {
            throw new Error("זהו לא התור שלך כעת.");
          }

          const currentBoard = serverGame.board;
          const serverRow = getAvailableRow(currentBoard, col);
          if (serverRow === null) {
            throw new Error("הטור הזה מלא, בחר טור אחר.");
          }

          const updatedBoard = currentBoard.map((r) => [...r]);
          updatedBoard[serverRow][col] = playerColor;

          const wonCells = checkWinner(updatedBoard, playerColor);
          const isDraw = isBoardFull(updatedBoard);

          const stepNextTurn = playerColor === "R" ? "Y" : "R";
          const updatedScores = { ...(serverGame.scores || {}) };
          const stepActiveMoverId = serverGame.players[playerColor] || currentUser.id;

          if (wonCells) {
            updatedScores[stepActiveMoverId] = (updatedScores[stepActiveMoverId] || 0) + 1;
          }

          const newGameState: GameState = {
            ...serverGame,
            board: updatedBoard,
            currentTurn: wonCells || isDraw ? playerColor : stepNextTurn,
            status: wonCells ? "finished" : isDraw ? "draw" : "active",
            winner: wonCells ? playerColor : null,
            winningCells: wonCells || [],
            lastMove: {
              player: playerColor,
              row: serverRow,
              col,
              at: Date.now(),
            },
            scores: updatedScores,
          };

          transaction.set(gameRef, {
            ...newGameState,
            board: serializeBoard(newGameState.board),
          });
        });
      } catch (err: any) {
        console.error("Connect 4 transaction error:", err);
        const errMsg = String(err.message || err).toLowerCase();
        if (errMsg.includes('quota') || errMsg.includes('exhausted') || err.code === 'resource-exhausted') {
          saveLocalGame(updatedGame);
          
          setMessage("עברנו למצב אופליין (מגבלות רשת). המשחק נשמר מקומית.");
        } else {
          saveLocalGame(previousLocalGame);
          if (err.message && (err.message.includes("תור") || err.message.includes("מלא") || err.message.includes("פעיל"))) {
            setMessage(err.message);
          } else {
            setMessage("נכשלה שמירת המהלך בשרת, אנא נסה שנית.");
          }
        }
      } finally {
        setIsMoveProcessing(false);
        processingRef.current = false;
      }
    } else {
      setIsMoveProcessing(false);
      processingRef.current = false;
    }
  }

  async function startNewGame() {
    if (!activeGame || resetLoading || scoresResetLoading) return;
    playSound("click");
    setPunishmentInput("");
    setPunishmentSent(false);
    setResetLoading(true);

    const nextTurn = activeGame.winner 
      ? (activeGame.winner === "R" ? "Y" : "R") 
      : (activeGame.currentTurn === "R" ? "Y" : "R");

    const resetGame: GameState = {
      ...activeGame,
      board: createEmptyBoard(),
      currentTurn: nextTurn,
      status: "active",
      winner: null,
      winningCells: [],
      lastMove: null,
      punishmentText: null,
    };

    saveLocalGame(resetGame);

    if (gameRef && !isLocalActive) {
      try {
        const firestoreResetGame = {
          ...resetGame,
          board: serializeBoard(resetGame.board),
        };
        await setDoc(gameRef, firestoreResetGame, { merge: true });
      } catch (err) {
        console.error("Connect 4 reset error:", err);
      } finally {
        setResetLoading(false);
      }
    } else {
      setResetLoading(false);
    }
  }

  async function resetScoresAndGame() {
    if (!currentUser || !partner || !activeGame || resetLoading || scoresResetLoading) return;
    playSound("click");
    setPunishmentInput("");
    setPunishmentSent(false);
    setScoresResetLoading(true);

    const initialScores = {
      [currentUser.id]: 0,
      [partner.id]: 0,
    };

    const nextTurn = activeGame.winner 
      ? (activeGame.winner === "R" ? "Y" : "R") 
      : (activeGame.currentTurn === "R" ? "Y" : "R");

    const resetGame: GameState = {
      ...activeGame,
      board: createEmptyBoard(),
      currentTurn: nextTurn,
      status: "active",
      winner: null,
      winningCells: [],
      lastMove: null,
      punishmentText: null,
      scores: initialScores,
    };

    saveLocalGame(resetGame);

    if (gameRef && !isLocalActive) {
      try {
        const firestoreResetGame = {
          ...resetGame,
          board: serializeBoard(resetGame.board),
        };
        await setDoc(gameRef, firestoreResetGame, { merge: true });
      } catch (err) {
        console.error("Connect 4 full reset error:", err);
      } finally {
        setScoresResetLoading(false);
      }
    } else {
      setScoresResetLoading(false);
    }
  }

  const handleSendPunishment = async () => {
    if (!punishmentInput.trim() || punishmentSent || !currentUser || !partner || !activeGame || punishmentSendLoading) return;

    try {
      playSound("send");
      setPunishmentSendLoading(true);
      await sendMission({
        title: "משימת עונש (ארבע בשורה)",
        shortText: punishmentInput.trim(),
        fullText: punishmentInput.trim(),
        sender: currentUser.id,
        receiver: partner.id,
        status: "sent",
        isMandatory: true,
      });

      const updatedGame = {
        ...activeGame,
        punishmentText: punishmentInput.trim(),
      };
      saveLocalGame(updatedGame);

      if (gameRef && !isLocalActive) {
        try {
          const firestoreUpdatedGame = {
            ...updatedGame,
            board: serializeBoard(updatedGame.board),
          };
          await setDoc(gameRef, firestoreUpdatedGame, { merge: true });
        } catch (err: any) {
          console.error("Failed to update punishment in Firestore:", err);
          const errMsg = String(err.message || err).toLowerCase();
          if (errMsg.includes('quota') || errMsg.includes('exhausted') || err.code === 'resource-exhausted') {
            
            // We keep it local
          }
        }
      }
      setPunishmentSent(true);
    } catch (err) {
      console.error("Failed to send punishment mission:", err);
      toast.error("שגיאה בשליחת העונש");
    } finally {
      setPunishmentSendLoading(false);
    }
  };

  function isWinningCell(row: number, col: number) {
    if (Array.isArray(activeGame?.winningCells) && activeGame!.winningCells.length > 0 && Array.isArray(activeGame!.winningCells[0])) {
      return (activeGame!.winningCells as any).some(([r, c]: [number, number]) => r === row && c === col);
    }
    return activeGame?.winningCells?.some((cell) => cell.r === row && cell.c === col);
  }

  useEffect(() => {
    if (activeGame?.status === "finished") {
      playSound("success");
    }
  }, [activeGame?.status]);

  if (loading && !isLocalActive) {
    return (
      <div className="flex items-center justify-center p-8 text-center min-h-[300px]">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Gamepad2 className="animate-spin text-blue-500" size={32} />
          <p>טוען לוח משחק...</p>
        </div>
      </div>
    );
  }

  if (!activeGame || !currentUser || !partner) {
    return (
      <div className="flex items-center justify-center p-8 text-center min-h-[300px]">
        <div className="text-red-500">שגיאה בטעינת משחק.</div>
      </div>
    );
  }

  const myScore = activeGame.scores?.[currentUser.id] || 0;
  const partnerScore = activeGame.scores?.[partner.id] || 0;

  return (
    <div className="p-4 sm:p-6 w-full mx-auto" dir="rtl">
      <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
        {/* Header */}
        <h2 className="text-2xl sm:text-3xl font-serif text-slate-800 mb-2 flex items-center justify-center gap-2">
          <Gamepad2 className="text-[#2563eb]" size={28} />
          ארבע בשורה
        </h2>
        <p className="text-sm text-slate-500 mb-3 block px-4">
          משחק זוגי תחרותי — עובד בלייב ומתעדכן אצל שניכם
        </p>

        {isLocalActive && (
          <div className="w-full max-w-[360px] mb-4 bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 text-right text-xs text-amber-800 leading-normal flex items-start gap-2 animate-fade-in shadow-inner">
            <span className="text-base">⚠️</span>
            <div>
              <p className="font-extrabold mb-0.5">מצב משחק מקומי פעיל (Resilient Offline Fallback)</p>
              <p>עקב מגבלות זמניות בשרתי הענן, המשחק עובר לפעול באופן מקומי על המכשיר הנוכחי ומאפשר לכם לשחק יחד בתורות ובנוחות!</p>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="mb-4 text-xs font-bold text-[#2563eb] hover:text-[#1d4ed8] bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1 cursor-pointer border border-blue-200"
        >
          <HelpCircle size={14} />
          {showExplanation ? "הסתר חוקי משחק" : "איך משחקים?"}
        </button>

        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full max-w-[360px] overflow-hidden text-right leading-relaxed text-sm bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4 shadow-inner"
            >
              <h4 className="font-extrabold text-slate-800 mb-2 flex items-center gap-1.5 text-xs">
                <BookOpen size={14} className="text-[#2563eb]" />
                חוקי המשחק - ארבע בשורה:
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600">
                <li><strong className="text-slate-800">המטרה:</strong> להשלים רצף של 4 דיסקיות בצבע שלך (אופקי, אנכי או אלכסוני) לפניהם.</li>
                <li><strong className="text-slate-800">התור שלך:</strong> לחץ על חץ מעל הטור הרצוי או ישירות בלוח כדי לשחרר דיסקית.</li>
                <li><strong className="text-slate-800">עונש למפסיד:</strong> המנצח ממלא משימת עונש שתישלח אוטומטית כעונש חובה לעמוד המשימות של המפסיד!</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full border-b border-slate-100 mb-6" />

        {/* Score Box */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-[360px] mb-6">
          <div
            className={`p-4 rounded-2xl border-2 transition-all ${
              activeGame.currentTurn === myColor && activeGame.status === "active"
                ? "border-blue-500 bg-blue-500/5"
                : "border-transparent bg-slate-50"
            }`}
          >
            <span
              className={`block text-xs font-bold mb-1 ${
                myColor === "R" ? "text-red-500" : "text-amber-500"
              }`}
            >
              את/ה ({myColor === "R" ? "🔴 אדום" : "🟡 צהוב"})
            </span>
            <strong className="block text-2xl text-slate-800 font-extrabold">
              {myScore}
            </strong>
          </div>
          <div
            className={`p-4 rounded-2xl border-2 transition-all ${
              activeGame.currentTurn === opponentColor && activeGame.status === "active"
                ? "border-amber-500 bg-amber-500/5"
                : "border-transparent bg-slate-50"
            }`}
          >
            <span
              className={`block text-xs font-bold mb-1 ${
                opponentColor === "R" ? "text-red-500" : "text-amber-400"
              }`}
            >
              {partner.name} ({opponentColor === "R" ? "🔴 אדום" : "🟡 צהוב"})
            </span>
            <strong className="block text-2xl text-slate-800 font-extrabold">
              {partnerScore}
            </strong>
          </div>
        </div>

        {/* Status Messages */}
        <div className="min-h-[44px] mb-6 text-base font-bold text-slate-700 flex items-center justify-center gap-1">
          {activeGame.status === "finished" && (
            <div className="flex items-center gap-1 text-green-600 bg-green-50 px-4 py-1.5 rounded-full border border-green-200 shadow-sm animate-bounce">
              <Trophy size={18} />
              <span>
                שחקן {colorName[activeGame.winner as "R" | "Y"]} (
                {activeGame.winner === myColor ? "את/ה!" : partner.name}) ניצח במשחק!
              </span>
            </div>
          )}
          {activeGame.status === "draw" && (
            <span className="text-slate-600 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-200">
              🤝 תיקו מעולה! שניכם אלופים.
            </span>
          )}
          {activeGame.status === "active" && (
            (isMyTurn || isLocalActive) ? (
              <span className="text-blue-600 animate-pulse flex items-center gap-1 bg-blue-50/50 px-4 py-1.5 rounded-full border border-blue-100">
                <Sparkles size={16} />
                {isLocalActive ? `תור הדיסקית: ${colorName[activeGame.currentTurn]}` : "שחקו את תורכם כעת!"}
              </span>
            ) : (
              <span className="text-slate-500 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
                ממתינים לתורו של {partner.name}...
              </span>
            )
          )}
        </div>

        {message && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2 rounded-xl mb-4 w-full max-w-[360px] animate-fade-in">
            {message}
          </div>
        )}

        {/* Drop Column Buttons */}
        <div className="w-full max-w-[360px] mb-2 px-1">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {Array.from({ length: COLS }).map((_, col) => {
              const row = getAvailableRow(activeGame.board, col);
              const isDisabled = (!isMyTurn && !isLocalActive) || activeGame.status !== "active" || row === null || isMoveProcessing;

              return (
                <button
                  key={col}
                  onClick={() => handleColumnClick(col)}
                  onMouseEnter={() => !isDisabled && setHoveredCol(col)}
                  onMouseLeave={() => setHoveredCol(null)}
                  disabled={isDisabled}
                  className={`h-9 rounded-lg flex items-center justify-center font-black transition-all ${
                    isDisabled
                      ? "bg-slate-100 text-slate-300 cursor-not-allowed opacity-30"
                      : "bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                  }`}
                  title="שחרר דיסקית"
                >
                  ↓
                </button>
              );
            })}
          </div>
        </div>

        {/* Connect 4 Cabinet Board */}
        <div className="w-full max-w-[360px] bg-blue-600 p-3 sm:p-4 rounded-3xl shadow-lg border-2 border-blue-700 relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent rounded-3xl pointer-events-none" />

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 bg-blue-700 p-2 sm:p-3 rounded-2xl">
            {activeGame.board.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const WinningCell = isWinningCell(rIdx, cIdx);
                const isHovered = hoveredCol === cIdx;
                const nextRowToPlace = getAvailableRow(activeGame.board, cIdx);

                const canInteract = (isMyTurn || isLocalActive) && nextRowToPlace !== null && !isMoveProcessing;

                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    onClick={() => {
                      if (canInteract) {
                        handleColumnClick(cIdx);
                      }
                    }}
                    className={`aspect-square rounded-full flex items-center justify-center relative cursor-pointer group transition-all duration-300 ${
                      WinningCell
                        ? "bg-green-100 shadow-[0_0_12px_rgba(34,197,94,0.6)] z-10 scale-105"
                        : "bg-blue-900 shadow-inner"
                    }`}
                  >
                    {/* Shadow Slot Preview */}
                    {(isMyTurn || isLocalActive) && isHovered && rIdx === nextRowToPlace && (
                      <div
                        className={`absolute inset-1 rounded-full opacity-40 animate-pulse border-2 border-dashed ${
                          activeGame.currentTurn === "R" ? "bg-red-400 border-red-200" : "bg-yellow-400 border-yellow-200"
                        }`}
                      />
                    )}

                    {/* Dropped Checker Disc */}
                    {cell && (
                      <motion.div
                        initial={{ y: -150, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 150, damping: 15 }}
                        className={`w-[85%] h-[85%] rounded-full shadow-md relative ${
                          cell === "R"
                            ? "bg-gradient-to-br from-red-400 via-red-500 to-red-800"
                            : "bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-600"
                        }`}
                      >
                        <div className="absolute inset-1.5 rounded-full border border-white/20" />
                        <div className="absolute inset-2.5 rounded-full border border-black/10" />
                        <div className="absolute inset-4 rounded-full border border-white/10" />
                      </motion.div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[360px] mb-4">
          <button
            onClick={startNewGame}
            disabled={resetLoading || scoresResetLoading}
            className="flex-1 py-3 px-5 rounded-full bg-blue-600 text-white font-bold transition-all hover:bg-blue-500 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm flex items-center justify-center gap-1"
          >
            <RotateCcw className={resetLoading ? "animate-spin" : ""} size={16} />
            {resetLoading ? "מאתחל..." : "סיבוב חדש"}
          </button>
          {currentUser?.name === "בועז" && (
            <button
              onClick={resetScoresAndGame}
              disabled={resetLoading || scoresResetLoading}
              className="py-3 px-5 rounded-full bg-slate-800 text-white font-bold transition-all hover:bg-slate-700 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm flex items-center justify-center gap-1"
            >
              {scoresResetLoading ? "מאפס..." : "איפוס משחק"}
            </button>
          )}
        </div>

        {/* Winner Punishment Module */}
        <AnimatePresence>
          {activeGame.status === "finished" && (activeGame.winner === myColor || isLocalActive) && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="w-full max-w-[360px] bg-slate-50 border border-green-200 rounded-3xl p-4 mt-2 mb-2"
            >
              <h3 className="font-bold border-b border-slate-200 pb-2 mb-3 text-slate-800 text-sm">
                🏆 {isLocalActive ? `דיסקית ${colorName[activeGame.winner as "R" | "Y"]} ניצחה! בחר/י עונש חובה:` : `ניצחת! בחר/י עונש חובה ל-${partner.name}:`}
              </h3>
              {punishmentSent ? (
                <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-sm font-medium">
                  משימת העונש נשלחה בהצלחה! 😈
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={punishmentInput}
                    onChange={(e) => setPunishmentInput(e.target.value)}
                    placeholder="דוגמה: תפנק/י אותי במסאז' של חצי שעה"
                    disabled={punishmentSendLoading}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[16px] focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendPunishment}
                    disabled={!punishmentInput.trim() || punishmentSendLoading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <Send className={punishmentSendLoading ? "animate-spin" : ""} size={16} />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Received Punishment Box (For the loser) */}
        <AnimatePresence>
          {activeGame.status === "finished" &&
            (activeGame.winner !== myColor || isLocalActive) &&
            activeGame.punishmentText && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-[360px] bg-red-50 border-2 border-red-500 rounded-3xl p-5 mt-4 shadow-md z-10 text-center relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />
                <h3 className="font-extrabold text-red-600 text-lg mb-1 flex items-center justify-center gap-1">
                  <span>🚨</span> משימת עונש חובה!
                </h3>
                <p className="text-red-900 font-medium mb-3 text-xs">
                  {isLocalActive ? `נקבע עונש חובה בעקבות ההפסד:` : `הפסדת! ${partner.name} קבע/ה לך עונש חובה:`}
                </p>
                <div className="bg-white border border-red-200 p-3.5 rounded-xl shadow-inner font-bold text-base text-slate-800">
                  {activeGame.punishmentText}
                </div>
                <p className="text-[10px] text-red-500 mt-3 font-semibold uppercase tracking-wider">
                  המשימה מחכה כעת בלשונית התיבת משימות
                </p>
              </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}
