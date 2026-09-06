import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Gamepad2, RotateCcw, UserCircle2, Info, X } from "lucide-react";
import { useApp } from "../lib/store";
import { db } from "../firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { playSound } from "../lib/sounds";
import { toast } from "sonner";
import { sendNotification } from "../lib/notifications";

const BOARD_WIDTH = 5; // 5 dots = 4 boxes
const BOARD_HEIGHT = 5;

interface DotsAndBoxesState {
  hLines: Record<string, string>; // "r,c" -> userId
  vLines: Record<string, string>; // "r,c" -> userId
  boxes: Record<string, string>; // "r,c" -> userId
  turn: string;
  status: "playing" | "won" | "draw";
  winner: string | null;
  updatedAt: number;
  scores: {
    [userId: string]: number;
  };
}

export function DotsAndBoxes() {
  const { currentUser, partner } = useApp();
  const [gameState, setGameState] = useState<DotsAndBoxesState | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const gameId =
    currentUser?.id && partner?.id
      ? [currentUser.id, partner.id].sort().join("_")
      : null;

  useEffect(() => {
    if (!gameId || !currentUser || !partner) return;

    const unsub = onSnapshot(
      doc(db, "games", `dotsandboxes_${gameId}`),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as DotsAndBoxesState;
          
          if (
            gameState?.turn !== currentUser.id &&
            data.turn === currentUser.id &&
            data.status === "playing" &&
            data.updatedAt > (gameState?.updatedAt || 0)
          ) {
            playSound("receive");
          }
          if (
            data.status === "won" &&
            gameState?.status !== "won" &&
            data.winner
          ) {
            if (data.winner === currentUser.id) {
              playSound("success");
              toast.success("ניצחת בקווים וריבועים! 🎉", {
                duration: 4000,
                position: "top-center",
              });
            } else if (data.winner === partner.id) {
              toast.error("הפסדת בקווים וריבועים... 😢", {
                duration: 4000,
                position: "top-center",
              });
            }
          }

          setGameState(data);
        } else {
          initGame();
        }
      }
    );

    return () => unsub();
  }, [gameId, currentUser, partner]);

  const initGame = async (turnOverride?: string) => {
    if (!gameId || !currentUser || !partner) return;
    const starter = turnOverride || (Math.random() > 0.5 ? currentUser.id : partner.id);
    
    const initialState: DotsAndBoxesState = {
      hLines: {},
      vLines: {},
      boxes: {},
      turn: starter,
      status: "playing",
      winner: null,
      updatedAt: Date.now(),
      scores: {
        [currentUser.id]: 0,
        [partner.id]: 0,
      },
    };
    await setDoc(doc(db, "games", `dotsandboxes_${gameId}`), initialState);
  };

  const checkBoxes = (
    hLines: Record<string, string>,
    vLines: Record<string, string>,
    oldBoxes: Record<string, string>
  ) => {
    let madeBox = false;
    const newBoxes = { ...oldBoxes };
    const myId = currentUser!.id;

    for (let r = 0; r < BOARD_HEIGHT - 1; r++) {
      for (let c = 0; c < BOARD_WIDTH - 1; c++) {
        const boxKey = `${r},${c}`;
        if (!newBoxes[boxKey]) {
          const top = hLines[`${r},${c}`];
          const bottom = hLines[`${r + 1},${c}`];
          const left = vLines[`${r},${c}`];
          const right = vLines[`${r},${c + 1}`];

          if (top && bottom && left && right) {
            newBoxes[boxKey] = myId;
            madeBox = true;
          }
        }
      }
    }
    return { madeBox, newBoxes };
  };

  const handleLineClick = async (type: "h" | "v", r: number, c: number) => {
    if (!gameState || !currentUser || !partner || !gameId) return;
    if (gameState.status !== "playing") return;
    if (gameState.turn !== currentUser.id) {
      toast.error("זה לא התור שלך!");
      playSound("error");
      return;
    }

    const key = `${r},${c}`;
    const isH = type === "h";

    if (isH && gameState.hLines[key]) return;
    if (!isH && gameState.vLines[key]) return;

    playSound("click");

    const newHLines = { ...gameState.hLines };
    const newVLines = { ...gameState.vLines };

    if (isH) newHLines[key] = currentUser.id;
    else newVLines[key] = currentUser.id;

    const { madeBox, newBoxes } = checkBoxes(newHLines, newVLines, gameState.boxes);

    let nextTurn = gameState.turn;
    let nextStatus = gameState.status;
    let nextWinner = gameState.winner;
    
    // Recalculate scores
    const myScore = Object.values(newBoxes).filter(id => id === currentUser.id).length;
    const partnerScore = Object.values(newBoxes).filter(id => id === partner.id).length;
    const newScores = {
      [currentUser.id]: myScore,
      [partner.id]: partnerScore
    };

    const totalBoxes = (BOARD_WIDTH - 1) * (BOARD_HEIGHT - 1);
    const boxesClaimed = Object.keys(newBoxes).length;

    if (boxesClaimed === totalBoxes) {
      nextStatus = "won";
      if (myScore > partnerScore) nextWinner = currentUser.id;
      else if (partnerScore > myScore) nextWinner = partner.id;
      else nextStatus = "draw";
    } else {
      if (!madeBox) {
        nextTurn = partner.id;
        
        // Notify partner it's their turn
        const pushTitle = `תורך לשחק!`;
        const pushBody = `תורך לשחק בקווים וריבועים נגד ${currentUser.name}`;
        sendNotification(pushTitle, { body: pushBody });
      } else {
        playSound("receive");
      }
    }

    const nextState: DotsAndBoxesState = {
      ...gameState,
      hLines: newHLines,
      vLines: newVLines,
      boxes: newBoxes,
      turn: nextTurn,
      status: nextStatus,
      winner: nextWinner,
      scores: newScores,
      updatedAt: Date.now(),
    };

    setGameState(nextState); // Optimistic update
    await setDoc(doc(db, "games", `dotsandboxes_${gameId}`), nextState);
  };

  if (!gameState || !currentUser || !partner) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6B6B]"></div>
      </div>
    );
  }

  const isMyTurn = gameState.turn === currentUser.id;
  const isDraw = gameState.status === "draw";
  const amIWinner = gameState.winner === currentUser.id;
  const isPartnerWinner = gameState.winner === partner.id;

  const myColor = "bg-[#3797f0]"; // Blue for me
  const partnerColor = "bg-[#FF6B6B]"; // Red for partner
  const activeColor = isMyTurn ? myColor : partnerColor;

  return (
    <div className="flex flex-col items-center max-w-lg mx-auto w-full p-4">
      
      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[32px] shadow-2xl p-6 w-full max-w-sm relative flex flex-col gap-4 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowHelp(false)}
                className="absolute top-4 left-4 p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
              
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 mb-2 shadow-sm border border-blue-100">
                <Info size={24} />
              </div>
              
              <h3 className="text-xl font-bold text-slate-800">איך משחקים?</h3>
              
              <ul className="space-y-3 text-slate-600 text-[15px] leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-[#3797f0] font-bold">•</span>
                  <span>כל אחד בתורו לוחץ בין שתי נקודות כדי למתוח קו.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#3797f0] font-bold">•</span>
                  <span>המטרה: לסגור ריבוע שלם (4 קווים מכל הכיוונים).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#3797f0] font-bold">•</span>
                  <span>סגרת ריבוע? קיבלת נקודה <b>וזכית בתור נוסף!</b></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#3797f0] font-bold">•</span>
                  <span>המשחק מסתיים כשכל הלוח מלא. מי שהשיג הכי הרבה ריבועים מנצח! 🏆</span>
                </li>
              </ul>
              
              <button
                onClick={() => setShowHelp(false)}
                className="mt-4 w-full bg-[#3797f0] text-white font-bold py-3.5 rounded-2xl hover:bg-blue-600 transition-colors shadow-md shadow-[#3797f0]/20"
              >
                הבנתי, בואו נשחק!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-slate-700 mr-2 flex items-center gap-2">
          <Gamepad2 size={20} className="text-[#9b59b6]" />
          קווים וריבועים
        </h2>
        <button 
          onClick={() => {
            playSound('click');
            setShowHelp(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold text-slate-500 hover:text-slate-700 bg-white rounded-xl shadow-sm border border-slate-200 transition-colors"
        >
          <Info size={16} />
          איך לשחק?
        </button>
      </div>

      {/* Game Header */}
      <div className="flex justify-between items-center w-full mb-6 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-md transition-all ${myColor} ${gameState.status === 'playing' && isMyTurn ? 'ring-4 ring-offset-2 ring-[#3797f0]/50 scale-110' : 'opacity-80'}`}>
              {currentUser.name[0]}
            </div>
            {gameState.status === 'playing' && isMyTurn && (
              <div className="absolute -bottom-2 -right-2 bg-white text-xs font-bold px-1.5 py-0.5 rounded-lg border border-slate-200 shadow-sm text-slate-700">תורי</div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 text-lg leading-none mb-1">את/ה</span>
            <span className="font-bold text-2xl text-[#3797f0] leading-none">{gameState.scores[currentUser.id] || 0}</span>
          </div>
        </div>
        
        <div className="text-slate-300 font-black text-2xl">-</div>
        
        <div className="flex items-center gap-3 flex-row-reverse">
          <div className="relative">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-md transition-all ${partnerColor} ${gameState.status === 'playing' && !isMyTurn ? 'ring-4 ring-offset-2 ring-[#FF6B6B]/50 scale-110' : 'opacity-80'}`}>
              {partner.name[0]}
            </div>
            {gameState.status === 'playing' && !isMyTurn && (
              <div className="absolute -bottom-2 -left-2 bg-white text-xs font-bold px-1.5 py-0.5 rounded-lg border border-slate-200 shadow-sm text-slate-700">תורו/ה</div>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="font-bold text-slate-800 text-lg leading-none mb-1">{partner.name}</span>
            <span className="font-bold text-2xl text-[#FF6B6B] leading-none">{gameState.scores[partner.id] || 0}</span>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="bg-white p-4 sm:p-8 rounded-[40px] shadow-sm border border-slate-200 select-none touch-none mb-6">
        <div 
          className="relative mx-auto" 
          style={{ 
            width: `${(BOARD_WIDTH - 1) * 60 + 20}px`, 
            height: `${(BOARD_HEIGHT - 1) * 60 + 20}px` 
          }}
        >
          {/* Render Boxes (Backgrounds) */}
          {Array.from({ length: BOARD_HEIGHT - 1 }).map((_, r) =>
            Array.from({ length: BOARD_WIDTH - 1 }).map((_, c) => {
              const boxOwner = gameState.boxes[`${r},${c}`];
              return (
                <div
                  key={`box-${r}-${c}`}
                  className={`absolute transition-colors duration-300 rounded-lg flex items-center justify-center`}
                  style={{
                    left: c * 60 + 10 + 4,
                    top: r * 60 + 10 + 4,
                    width: 60 - 8,
                    height: 60 - 8,
                    backgroundColor: boxOwner
                      ? boxOwner === currentUser.id
                        ? "rgba(55, 151, 240, 0.2)"
                        : "rgba(255, 107, 107, 0.2)"
                      : "transparent",
                  }}
                >
                  {boxOwner && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`text-3xl font-black opacity-30 ${
                        boxOwner === currentUser.id ? "text-[#3797f0]" : "text-[#FF6B6B]"
                      }`}
                    >
                      {boxOwner === currentUser.id ? currentUser.name[0] : partner.name[0]}
                    </motion.div>
                  )}
                </div>
              );
            })
          )}

          {/* Render Horizontal Lines */}
          {Array.from({ length: BOARD_HEIGHT }).map((_, r) =>
            Array.from({ length: BOARD_WIDTH - 1 }).map((_, c) => {
              const lineOwner = gameState.hLines[`${r},${c}`];
              return (
                <div
                  key={`h-${r}-${c}`}
                  className="absolute cursor-pointer group flex items-center justify-center z-10"
                  style={{ left: c * 60 + 10, top: r * 60 - 10, width: 60, height: 40 }}
                  onClick={() => handleLineClick("h", r, c)}
                >
                  <div
                    className={`h-2.5 rounded-full transition-all duration-200 ${
                      lineOwner
                        ? lineOwner === currentUser.id
                          ? "bg-[#3797f0]"
                          : "bg-[#FF6B6B]"
                        : "bg-slate-200 group-hover:bg-slate-300"
                    }`}
                    style={{ width: "100%" }}
                  />
                </div>
              );
            })
          )}

          {/* Render Vertical Lines */}
          {Array.from({ length: BOARD_HEIGHT - 1 }).map((_, r) =>
            Array.from({ length: BOARD_WIDTH }).map((_, c) => {
              const lineOwner = gameState.vLines[`${r},${c}`];
              return (
                <div
                  key={`v-${r}-${c}`}
                  className="absolute cursor-pointer group flex items-center justify-center z-10"
                  style={{ left: c * 60 - 10, top: r * 60 + 10, width: 40, height: 60 }}
                  onClick={() => handleLineClick("v", r, c)}
                >
                  <div
                    className={`w-2.5 rounded-full transition-all duration-200 ${
                      lineOwner
                        ? lineOwner === currentUser.id
                          ? "bg-[#3797f0]"
                          : "bg-[#FF6B6B]"
                        : "bg-slate-200 group-hover:bg-slate-300"
                    }`}
                    style={{ height: "100%" }}
                  />
                </div>
              );
            })
          )}

          {/* Render Dots */}
          {Array.from({ length: BOARD_HEIGHT }).map((_, r) =>
            Array.from({ length: BOARD_WIDTH }).map((_, c) => (
              <div
                key={`dot-${r}-${c}`}
                className="absolute w-[20px] h-[20px] bg-slate-800 rounded-full z-20 shadow-sm"
                style={{ left: c * 60, top: r * 60 }}
              />
            ))
          )}
        </div>
      </div>

      {/* Status & Actions */}
      <div className="w-full">
        {gameState.status === "won" && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-3xl text-center shadow-lg font-bold text-white text-lg ${
              amIWinner
                ? "bg-gradient-to-r from-blue-400 to-[#3797f0]"
                : "bg-gradient-to-r from-red-400 to-[#FF6B6B]"
            }`}
          >
            {amIWinner ? "🎉 כל הכבוד! ניצחת!" : `${partner.name} ניצח/ה! 😢`}
          </motion.div>
        )}
        
        {isDraw && (
           <motion.div
           initial={{ scale: 0.9, opacity: 0, y: 10 }}
           animate={{ scale: 1, opacity: 1, y: 0 }}
           className="mb-6 p-4 rounded-3xl text-center shadow-md font-bold bg-slate-800 text-white text-lg"
         >
           תיקו! עבודה יפה לשניכם! 🤝
         </motion.div>
        )}

        <div className="flex gap-3">
          {gameState.status !== "playing" && (
            <button
              onClick={() => {
                playSound("click");
                // Loser starts next round, or random if draw
                let nextStarter;
                if (gameState.winner === currentUser.id) nextStarter = partner.id;
                else if (gameState.winner === partner.id) nextStarter = currentUser.id;
                else nextStarter = Math.random() > 0.5 ? currentUser.id : partner.id;
                initGame(nextStarter);
              }}
              className="flex-1 bg-white text-slate-800 border-2 border-slate-200 px-6 py-4 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <RotateCcw size={22} />
              משחק חדש
            </button>
          )}
          
          {gameState.status === "playing" && (
            <button
              onClick={() => {
                if (window.confirm("בטוח שרוצה לאפס את המשחק?")) {
                  playSound("click");
                  initGame();
                }
              }}
              className="w-full bg-white text-slate-600 border border-slate-200 px-4 py-3 rounded-2xl font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              איפוס לוח
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
