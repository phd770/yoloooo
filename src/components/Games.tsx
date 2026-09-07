import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Gamepad2,
  RotateCcw,
  UserCircle2,
  Trash2,
  Send,
  Grid3X3,
  Dice5,
} from "lucide-react";
import { useApp } from "../lib/store";
import { db } from "../firebase";
import { toast } from "sonner";
import { playSound } from "../lib/sounds";
import { sendNotification, requestNotificationPermission } from "../lib/notifications";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { ConnectFour } from "./ConnectFour";
import { DotsAndBoxes } from "./DotsAndBoxes";
import { Backgammon } from "./Backgammon";

interface TicTacToeState {
  board: string[];
  turn: string;
  status: "playing" | "won" | "draw";
  winner: string | null;
  winningLine: number[];
  updatedAt: number;
  scores: {
    [userId: string]: number;
  };
  punishmentText?: string | null;
}

export function TicTacToe() {
  const { currentUser, partner, sendMission } = useApp();
  const [gameState, setGameState] = useState<TicTacToeState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [missionText, setMissionText] = useState("");
  const [missionSent, setMissionSent] = useState(false);

  const gameId =
    currentUser?.id && partner?.id
      ? [currentUser.id, partner.id].sort().join("_")
      : null;

  useEffect(() => {
    if (!gameId || !currentUser || !partner) return;

    if (false) {
      setErrorMsg(null);
      const localStored = localStorage.getItem(`tictactoe_local_${gameId}`);
      if (localStored) {
        setGameState(JSON.parse(localStored));
      } else {
        const firstPlayer = currentUser.id;
        const initialS: TicTacToeState = {
          board: Array(9).fill(""),
          turn: firstPlayer,
          status: "playing",
          winner: null,
          winningLine: [],
          updatedAt: Date.now(),
          scores: {
            [currentUser.id]: 0,
            [partner.id]: 0,
          },
        };
        setGameState(initialS);
        localStorage.setItem(`tictactoe_local_${gameId}`, JSON.stringify(initialS));
      }
      return;
    }

    setErrorMsg(null);
    const gameDocRef = doc(db, "games", `tictactoe_${gameId}`);

    const initGame = async () => {
      try {
        const firstPlayer = Math.random() > 0.5 ? currentUser.id : partner.id;
        const newState: TicTacToeState = {
          board: Array(9).fill(""),
          turn: firstPlayer,
          status: "playing",
          winner: null,
          winningLine: [],
          updatedAt: Date.now(),
          scores: {
            [currentUser.id]: 0,
            [partner.id]: 0,
          },
        };
        await setDoc(gameDocRef, newState);
      } catch (err) {
        console.error("Failed to initialize game:", err);
        setErrorMsg("שגיאה בהתחלת משחק");
      }
    };

    const unsubscribe = onSnapshot(
      gameDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as TicTacToeState;
          if (!data.winningLine) data.winningLine = [];

          if (!data.scores) {
            data.scores = {
              [currentUser.id]: 0,
              [partner.id]: 0,
            };
          }
          if (typeof data.scores[currentUser.id] !== "number")
            data.scores[currentUser.id] = 0;
          if (typeof data.scores[partner.id] !== "number")
            data.scores[partner.id] = 0;

          setGameState(data);
          setErrorMsg(null);
        } else if (!(docSnap as any).metadata.fromCache) {
          initGame();
        }
      },
      (error: any) => {
        const errMsg = String(error.message || error).toLowerCase();
        if (errMsg.includes('quota') || errMsg.includes('exhausted') || error.code === 'resource-exhausted' || error.code === 'unavailable' || errMsg.includes('offline')) {
          console.warn("Quota or connection error, working offline (TicTacToe snapshot)");
        } else {
          console.error("Firebase snapshot error:", error);
          setErrorMsg("שגיאת התחברות לשרת. נא לרענן.");
        }
        try {
          const saved = localStorage.getItem(`tictactoe_local_${gameId}`);
          if (saved) {
            setGameState(JSON.parse(saved) as TicTacToeState);
          } else {
            const fallbackState: TicTacToeState = {
              board: Array(9).fill(""),
              turn: currentUser.id,
              status: "playing",
              winner: null,
              winningLine: [],
              updatedAt: Date.now(),
              scores: { [currentUser.id]: 0, [partner.id]: 0 },
            };
            setGameState(fallbackState);
            localStorage.setItem(`tictactoe_local_${gameId}`, JSON.stringify(fallbackState));
          }
        } catch (storageError) {
          console.error("Failed to load local TicTacToe state:", storageError);
        }
      },
    );

    return () => unsubscribe();
  }, [gameId, currentUser, partner]);

  const startNewGame = async () => {
    if (!gameId || !currentUser || !partner || !gameState) return;
    try {
      setMissionText("");
      setMissionSent(false);

      const firstPlayer =
        gameState.winner === currentUser.id ? partner.id : currentUser.id;

      const newState: TicTacToeState = {
        board: Array(9).fill(""),
        turn: firstPlayer,
        status: "playing",
        winner: null,
        winningLine: [],
        updatedAt: Date.now(),
        scores: gameState.scores,
        punishmentText: null,
      };



      const gameDocRef = doc(db, "games", `tictactoe_${gameId}`);
      await setDoc(gameDocRef, newState as any, { merge: true });
    } catch (err) {
      console.error("Failed to restart game:", err);
    }
  };

  const resetScoresAndGame = async () => {
    if (!gameId || !currentUser || !partner) return;
    try {
      setMissionText("");
      setMissionSent(false);

      const firstPlayer = currentUser.id;
      const newState: TicTacToeState = {
        board: Array(9).fill(""),
        turn: firstPlayer,
        status: "playing",
        winner: null,
        winningLine: [],
        updatedAt: Date.now(),
        scores: {
          [currentUser.id]: 0,
          [partner.id]: 0,
        },
        punishmentText: null,
      };



      const gameDocRef = doc(db, "games", `tictactoe_${gameId}`);
      await setDoc(gameDocRef, newState as any, { merge: true });
    } catch (err) {
      console.error("Failed to reset scores:", err);
    }
  };

  const handleCellClick = async (index: number) => {
    if (!gameState || !currentUser || !partner || !gameId) return;
    // Prevent moves if not playing, not your turn, or cell is full
    if (
      gameState.status !== "playing" ||
      gameState.turn !== currentUser.id ||
      gameState.board[index] !== ""
    ) {
      return;
    }

    const newBoard = [...gameState.board];
    newBoard[index] = currentUser.id;

    let newStatus = gameState.status;
    let newWinner = gameState.winner;
    let newWinningLine: number[] = [];

    const winningOptions = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8], // Rows
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8], // Cols
      [0, 4, 8],
      [2, 4, 6], // Diagonals
    ];

    let foundWinnerPlayer: string | null = null;
    let foundWinningLine: number[] = [];

    for (let line of winningOptions) {
      const [a, b, c] = line;
      if (
        newBoard[a] &&
        newBoard[a] === newBoard[b] &&
        newBoard[a] === newBoard[c]
      ) {
        foundWinnerPlayer = newBoard[a];
        foundWinningLine = line;
        break;
      }
    }

    let newScores = { ...gameState.scores };

    if (foundWinnerPlayer) {
      newStatus = "won";
      newWinner = foundWinnerPlayer;
      newWinningLine = foundWinningLine;
      newScores[foundWinnerPlayer] = (newScores[foundWinnerPlayer] || 0) + 1;
    } else if (newBoard.every((cell) => cell !== "")) {
      newStatus = "draw";
    }

    const updatedState: TicTacToeState = {
      ...gameState,
      board: newBoard,
      turn: partner.id,
      status: newStatus,
      winner: newWinner,
      winningLine: newWinningLine,
      updatedAt: Date.now(),
      scores: newScores,
    };



    const gameDocRef = doc(db, "games", `tictactoe_${gameId}`);

    // Update in firebase instantly
    try {
      await setDoc(gameDocRef, {
        board: newBoard,
        turn: partner.id,
        status: newStatus,
        winner: newWinner,
        winningLine: newWinningLine,
        updatedAt: Date.now(),
        scores: newScores,
      }, { merge: true });
    } catch (err: any) {
      const errMsg = String(err.message || err).toLowerCase();
      if (errMsg.includes('quota') || errMsg.includes('exhausted') || err.code === 'resource-exhausted') {
        setGameState(updatedState);
        localStorage.setItem(`tictactoe_local_${gameId}`, JSON.stringify(updatedState));
        
        import("sonner").then(({ toast }) => toast.info("עברנו למצב אופליין. רשת לא זמינה."));
      } else {
         console.error(err);
      }
    }
  };

  const handleSendPunishment = async () => {
    if (!missionText.trim() || missionSent) return;

    try {
      if (false) {
        if (gameState) {
          const updatedState = { ...gameState, punishmentText: missionText.trim() };
          setGameState(updatedState);
          localStorage.setItem(`tictactoe_local_${gameId}`, JSON.stringify(updatedState));
        }
        setMissionSent(true);
        import("sonner").then(({ toast }) =>
          toast.success("משימת העונש נשמרה מקומית!"),
        );
        return;
      }

      await sendMission({
        title: "משימת עונש (איקס עיגול)",
        shortText: missionText.trim(),
        fullText: missionText.trim(),
        sender: currentUser!.id,
        receiver: partner!.id,
        status: "sent",
        isMandatory: true,
      });
      await updateDoc(doc(db, "games", `tictactoe_${gameId}`), {
        punishmentText: missionText.trim(),
      });
      setMissionSent(true);
      import("sonner").then(({ toast }) =>
        toast.success("משימת העונש נשלחה בהצלחה!"),
      );
    } catch (err) {
      console.error(err);
      import("sonner").then(({ toast }) => toast.error("שגיאה בשליחת משימה"));
    }
  };

  const isMyTurn =
    gameState?.status === "playing" && gameState?.turn === currentUser?.id;

  useEffect(() => {
    if (isMyTurn) {
      toast.info("תורך לשחק באיקס-עיגול! ❌⭕", {
        description: "המשבצת הבאה מחכה לך...",
        duration: 3000,
      });
      playSound('success');
      sendNotification("תורך לשחק באיקס-עיגול! ❌⭕", { body: "המשבצת הבאה מחכה לך..." });
    }
  }, [isMyTurn]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  if (errorMsg) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-center">
        <div className="flex flex-col items-center gap-4 text-red-400">
          <Gamepad2 size={32} />
          <p>{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg"
          >
            רענון
          </button>
        </div>
      </div>
    );
  }

  if (!gameState || !currentUser || !partner) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center gap-4 text-slate-400">
          <Gamepad2 size={32} />
          <p>טוען משחק...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 w-full mx-auto">
      <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
        <h2 className="text-2xl sm:text-3xl font-serif text-slate-800 mb-2 flex items-center justify-center gap-2">
          <Gamepad2 className="text-[#FF6B6B]" size={28} />
          איקס עיגול
        </h2>
        <p className="text-sm text-slate-500 mb-8 border-b-2 border-slate-100 pb-4 inline-block px-4">
          שחקן מול שחקן — מי לוקח את הסיבוב?
        </p>

        {/* Score Box */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-[340px] mb-8">
          <div
            className={`p-4 rounded-2xl border-2 transition-all ${gameState.turn === currentUser.id ? "border-[#FF6B6B] bg-[#FF6B6B]/5" : "border-transparent bg-slate-50"}`}
          >
            <span
              className={`block text-sm font-bold mb-1 ${gameState.turn === currentUser.id ? "text-[#FF6B6B]" : "text-slate-500"}`}
            >
              את/ה ({currentUser.id < partner.id ? "✕" : "◯"})
            </span>
            <strong className="block text-3xl text-slate-800 font-black">
              {gameState.scores?.[currentUser.id] ?? 0}
            </strong>
          </div>
          <div
            className={`p-4 rounded-2xl border-2 transition-all ${gameState.turn === partner.id ? "border-indigo-500 bg-indigo-500/5" : "border-transparent bg-slate-50"}`}
          >
            <span
              className={`block text-sm font-bold mb-1 ${gameState.turn === partner.id ? "text-indigo-500" : "text-slate-500"}`}
            >
              {partner.name} ({partner.id < currentUser.id ? "✕" : "◯"})
            </span>
            <strong className="block text-3xl text-slate-800 font-black">
              {gameState.scores?.[partner.id] ?? 0}
            </strong>
          </div>
        </div>

        {/* Status MSG */}
        <div className="min-h-[32px] mb-6 text-lg font-bold text-slate-800">
          {gameState.status === "won" &&
            gameState.winner === currentUser.id && <>🎉 ניצחת!</>}
          {gameState.status === "won" && gameState.winner === partner.id && (
            <>🥲 {partner.name} ניצח/ה!</>
          )}
          {gameState.status === "draw" && <>🤝 תיקו! משחק צמוד.</>}
          {gameState.status === "playing" && isMyTurn && (
            <span className="text-[#FF6B6B]">התור שלך תוקף!</span>
          )}
          {gameState.status === "playing" && !isMyTurn && (
            <span className="text-slate-500">התור של {partner.name}</span>
          )}
        </div>

        {/* Board */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-10 w-full max-w-[340px]">
          {gameState.board.map((cellObj, idx) => {
            const isMe = cellObj === currentUser.id;
            const isPartner = cellObj === partner.id;
            const isWinningCell = gameState.winningLine?.includes(idx);
            const isX = (isMe && currentUser.id < partner.id) || (isPartner && partner.id < currentUser.id);
            const isO = (isMe && partner.id < currentUser.id) || (isPartner && currentUser.id < partner.id);
            const winnerBg = gameState.winner === partner.id ? "bg-indigo-500" : "bg-[#FF6B6B]";

            return (
              <button
                key={idx}
                onClick={() => {
                  if (cellObj) return;
                  if (!isMyTurn || gameState.status !== "playing") {
                    import("sonner").then(({ toast }) => {
                      if (gameState.status === "playing")
                        toast("זה התור של " + partner.name, {
                          position: "top-center",
                        });
                    });
                    return;
                  }
                  handleCellClick(idx);
                }}
                className={`aspect-square rounded-2xl sm:rounded-[20px] text-4xl sm:text-5xl font-black flex items-center justify-center transition-all duration-200 ${
                  isWinningCell
                    ? `${winnerBg} text-white scale-105 shadow-md z-10`
                    : cellObj
                      ? "bg-slate-100 cursor-default"
                      : isMyTurn && gameState.status === "playing"
                        ? "bg-slate-50 hover:bg-[#FF6B6B]/10 hover:shadow-sm cursor-pointer"
                        : "bg-slate-50/50 cursor-not-allowed"
                }`}
              >
                {cellObj && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={isWinningCell ? "text-white" : isMe ? "text-[#FF6B6B]" : "text-indigo-500"}
                  >
                    {isX ? "✕" : "◯"}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[340px] mb-6">
          {currentUser?.id === "boaz" && (
            <button
              onClick={startNewGame}
              className="flex-1 py-4 px-6 rounded-full bg-[#FF6B6B] text-white font-bold transition-all hover:bg-[#ff5252] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              משחק חדש
            </button>
          )}
          {currentUser?.name === "בועז" && (
            <button
              onClick={resetScoresAndGame}
              className="flex-none py-4 px-6 rounded-full bg-slate-800 text-white font-bold transition-all hover:bg-slate-700 active:translate-y-0 flex items-center justify-center gap-2"
            >
              איפוס ניקוד
            </button>
          )}
        </div>

        {/* Punishment Box */}
        {gameState.status === "won" && gameState.winner === currentUser.id && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="w-full max-w-[340px] bg-slate-50 border border-[#FF6B6B]/20 rounded-2xl p-4 mt-2 mb-2"
          >
            <h3 className="font-bold border-b border-slate-200 pb-2 mb-3 text-slate-800 text-sm">
              המפסיד משלם! שלח/י עונש חובה:
            </h3>
            {missionSent ? (
              <div className="bg-[#FF6B6B]/10 text-[#FF6B6B] p-3 rounded-xl text-sm font-medium">
                משימת העונש נשלחה בהצלחה! 😈
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={missionText}
                  onChange={(e) => setMissionText(e.target.value)}
                  placeholder="דוגמה: תעשה/י לי מסאז׳"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[16px] focus:outline-none focus:border-[#FF6B6B] transition-colors"
                />
                <button
                  onClick={handleSendPunishment}
                  disabled={!missionText.trim()}
                  className="bg-[#FF6B6B] hover:bg-[#ff5252] disabled:opacity-50 text-white p-2 rounded-xl transition-colors flex items-center justify-center"
                >
                  <Send size={18} />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Received Punishment Box (For the loser) */}
        {gameState.status === "won" &&
          gameState.winner !== currentUser.id &&
          gameState.punishmentText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full justify-center max-w-[340px] bg-red-50 border-2 border-red-500 rounded-3xl p-6 mt-4 shadow-xl z-20 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse"></div>
              <h3 className="font-black text-red-600 text-xl mb-2 flex items-center justify-center gap-2">
                <span>🚨</span> משימת עונש התקבלה!
              </h3>
              <p className="text-red-900 font-medium mb-4 text-sm">
                הפסדת, ולכן {partner.name} החליט לפנק אותך בעונש:
              </p>
              <div className="bg-white border-2 border-red-200 p-4 rounded-xl shadow-inner font-bold text-lg text-slate-800">
                {gameState.punishmentText}
              </div>
              <p className="text-xs text-red-500 mt-4 opacity-75 font-bold uppercase tracking-widest">
                ניתן למצוא את המשימה בלשונית התיבת משימות
              </p>
            </motion.div>
          )}
      </div>
    </div>
  );
}

export function Games() {
  type GameTab = "tictactoe" | "connectfour" | "backgammon" | "dotsandboxes";
  const [activeGame, setActiveGame] = useState<GameTab>(() => {
    try {
      const savedGame = localStorage.getItem('dateapp_active_game');
      return savedGame && ['tictactoe', 'connectfour', 'backgammon', 'dotsandboxes'].includes(savedGame)
        ? savedGame as GameTab
        : 'dotsandboxes';
    } catch {
      return 'dotsandboxes';
    }
  });

  useEffect(() => {
    localStorage.setItem('dateapp_active_game', activeGame);
  }, [activeGame]);

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto">
      <div className="sticky top-0 z-20 flex flex-wrap justify-center gap-2 border-b border-slate-100 bg-white/95 p-4 backdrop-blur-xl">
        <button
          onClick={() => setActiveGame("dotsandboxes")}
          className={`px-4 py-2 rounded-2xl flex items-center gap-2 transition-all font-bold cursor-pointer ${
            activeGame === "dotsandboxes"
              ? "bg-[#9b59b6] text-white shadow-md shadow-[#9b59b6]/20"
              : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <Grid3X3 size={18} />
          קווים וריבועים
        </button>
        <button
          onClick={() => setActiveGame("tictactoe")}
          className={`px-4 py-2 rounded-2xl flex items-center gap-2 transition-all font-bold cursor-pointer ${
            activeGame === "tictactoe"
              ? "bg-[#FF6B6B] text-white shadow-md shadow-[#FF6B6B]/20"
              : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <Grid3X3 size={18} />
          איקס עיגול
        </button>
        <button
          onClick={() => setActiveGame("connectfour")}
          className={`px-4 py-2 rounded-2xl flex items-center gap-2 transition-all font-bold cursor-pointer ${
            activeGame === "connectfour"
              ? "bg-[#2563eb] text-white shadow-md shadow-[#2563eb]/20"
              : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <Gamepad2 size={18} />
          ארבע בשורה
        </button>
        <button
          onClick={() => setActiveGame("backgammon")}
          className={`px-4 py-2 rounded-2xl flex items-center gap-2 transition-all font-bold cursor-pointer ${
            activeGame === "backgammon"
              ? "bg-[#ea580c] text-white shadow-md shadow-[#ea580c]/20"
              : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <Dice5 size={18} />
          שש בש
        </button>
      </div>

      <div className="flex-1 w-full overflow-y-auto">
        {activeGame === "dotsandboxes" && <DotsAndBoxes />}
        {activeGame === "tictactoe" && <TicTacToe />}
        {activeGame === "connectfour" && <ConnectFour />}
        {activeGame === "backgammon" && <Backgammon />}
      </div>
    </div>
  );
}
