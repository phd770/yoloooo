import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useApp } from "../lib/store";
import { toast } from "sonner";
import { playSound } from "../lib/sounds";
import { sendNotification, requestNotificationPermission } from "../lib/notifications";
import { Dice5, RotateCcw, Sparkles, Trophy, Users, HelpCircle, BookOpen } from "lucide-react";

interface CheckerPoint {
  player: string | null; // userId of the player holding this point
  count: number;
}

interface BackgammonState {
  type: string;
  player1: string; // White player
  player2: string; // Black player
  playerNames: {
    [userId: string]: string;
  };
  turn: string; // Current player userId
  points: CheckerPoint[]; // 24 points
  dice: number[]; // the last rolled numbers
  hasRolled: boolean;
  movesLeft: number[]; // remaining unused moves
  bar: {
    [userId: string]: number;
  };
  off: {
    [userId: string]: number;
  };
  status: "active" | "finished";
  winner: string | null;
  scores?: {
    [userId: string]: number;
  };
  punishmentText?: string | null;
}

const HOME_START_P1 = 0;   // White home points: 0, 1, 2, 3, 4, 5
const HOME_END_P1 = 5;
const HOME_START_P2 = 18;  // Black home points: 18, 19, 20, 21, 22, 23
const HOME_END_P2 = 23;

function createInitialPoints(p1: string, p2: string): CheckerPoint[] {
  const points = Array.from({ length: 24 }, () => ({ player: null, count: 0 } as CheckerPoint));

  // Traditional Backgammon starting positions (Mirrored for reversed flow)
  // White (Player 1) moves from 23 to 0
  // Black (Player 2) moves from 0 to 23

  // Point 23: 2 White
  points[23] = { player: p1, count: 2 };
  // Point 0: 2 Black
  points[0] = { player: p2, count: 2 };

  // Point 12: 5 White
  points[12] = { player: p1, count: 5 };
  // Point 11: 5 Black
  points[11] = { player: p2, count: 5 };

  // Point 7: 3 White
  points[7] = { player: p1, count: 3 };
  // Point 16: 3 Black
  points[16] = { player: p2, count: 3 };

  // Point 5: 5 White
  points[5] = { player: p1, count: 5 };
  // Point 18: 5 Black
  points[18] = { player: p2, count: 5 };

  return points;
}

export function Backgammon() {
  const { currentUser, partner, sendMission } = useApp();
  const [dbGameState, setDbGameState] = useState<BackgammonState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | "bar" | null>(null);
  const [message, setMessage] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [isOfflinePlay, setIsOfflinePlay] = useState(false);
  const [localGameState, setLocalGameState] = useState<BackgammonState | null>(null);
  const [missionText, setMissionText] = useState("");
  const [missionSent, setMissionSent] = useState(false);

  const gameId = useMemo(() => {
    if (!currentUser?.id || !partner?.id) return null;
    return [currentUser.id, partner.id].sort().join("_");
  }, [currentUser?.id, partner?.id]);

  const gameRef = useMemo(() => {
    if (!gameId) return null;
    return doc(db, "games", `backgammon_${gameId}`);
  }, [gameId]);

  const initialLocalState = useMemo<BackgammonState | null>(() => {
    if (!currentUser || !partner) return null;
    const initialPoints = createInitialPoints(currentUser.id, partner.id);
    return {
      type: "backgammon",
      player1: currentUser.id,
      player2: partner.id,
      playerNames: {
        [currentUser.id]: currentUser.name,
        [partner.id]: partner.name,
      },
      turn: currentUser.id,
      points: initialPoints,
      dice: [2, 4],
      hasRolled: false,
      movesLeft: [],
      bar: {
        [currentUser.id]: 0,
        [partner.id]: 0,
      },
      off: {
        [currentUser.id]: 0,
        [partner.id]: 0,
      },
      status: "active",
      winner: null,
      scores: {
        [currentUser.id]: 0,
        [partner.id]: 0,
      },
      punishmentText: null,
    };
  }, [currentUser, partner]);

  // Load from local storage or initialize
  useEffect(() => {
    if (!initialLocalState) return;
    try {
      const saved = localStorage.getItem("dateapp_backgammon_game");
      if (saved) {
        setLocalGameState(JSON.parse(saved));
      } else {
        setLocalGameState(initialLocalState);
      }
    } catch {
      setLocalGameState(initialLocalState);
    }
  }, [initialLocalState]);

  const saveLocalGameState = (nextState: BackgammonState) => {
    setLocalGameState(nextState);
    try {
      localStorage.setItem("dateapp_backgammon_game", JSON.stringify(nextState));
    } catch {}
  };

  const isLocalActive = false || isOfflinePlay;
  const gameState = isLocalActive ? localGameState : (dbGameState || localGameState);
  const isMyTurn = gameState?.turn === currentUser?.id && gameState?.status === "active";
  const isPlayer1 = currentUser?.id === gameState?.player1; // True = White, False = Black

  useEffect(() => {
    if (isMyTurn && gameState?.status === "active") {
      toast.info("תורך לשחק בשש-בש! 🎲", {
        description: "הקוביות מחכות לך...",
        duration: 3000,
      });
      playSound('success'); // Optional: play sound
      sendNotification("תורך לשחק בשש-בש! 🎲", { body: "הקוביות מחכות לך..." });
    }
  }, [isMyTurn, gameState?.status]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

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
          const initialPoints = createInitialPoints(currentUser!.id, partner!.id);
          const initialData: BackgammonState = {
            type: "backgammon",
            player1: currentUser!.id,
            player2: partner!.id,
            playerNames: {
              [currentUser!.id]: currentUser!.name,
              [partner!.id]: partner!.name,
            },
            turn: currentUser!.id,
            points: initialPoints,
            dice: [2, 4],
            hasRolled: false,
            movesLeft: [],
            bar: {
              [currentUser!.id]: 0,
              [partner!.id]: 0,
            },
            off: {
              [currentUser!.id]: 0,
              [partner!.id]: 0,
            },
            status: "active",
            winner: null,
            scores: {
              [currentUser!.id]: 0,
              [partner!.id]: 0,
            },
            punishmentText: null,
          };
          await setDoc(gameRef!, initialData);
          saveLocalGameState(initialData);
        }
      } catch (e) {
        console.error("Failed to initialize Backgammon in Firestore:", e);
        setIsOfflinePlay(true);
      }
    }

    initGame();

    const unsubscribe = onSnapshot(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as BackgammonState;
        setDbGameState(data);
        saveLocalGameState(data);
        setLoading(false);
      }
    }, (error: any) => {
      const errMsg = String(error.message || error).toLowerCase();
      if (errMsg.includes('quota') || errMsg.includes('exhausted') || error.code === 'resource-exhausted' || error.code === 'unavailable' || errMsg.includes('offline')) {
        console.warn("Quota or connection error, working offline (Backgammon snapshot)");
      } else {
        console.error("Backgammon subscription error:", error);
      }
      setIsOfflinePlay(true);
    });

    return () => unsubscribe();
  }, [gameRef, currentUser, partner, isLocalActive]);

  // Visual layout division: The active player's home board is ALWAYS on the bottom-right
  const topRowLeft = isPlayer1
    ? [12, 13, 14, 15, 16, 17]
    : [11, 10, 9, 8, 7, 6];
  const topRowRight = isPlayer1
    ? [18, 19, 20, 21, 22, 23]
    : [5, 4, 3, 2, 1, 0];

  const bottomRowLeft = isPlayer1
    ? [11, 10, 9, 8, 7, 6]
    : [12, 13, 14, 15, 16, 17];
  const bottomRowRight = isPlayer1
    ? [5, 4, 3, 2, 1, 0]
    : [18, 19, 20, 21, 22, 23];

  // Roll dice
  async function rollDice() {
    if (!gameState || !isMyTurn || gameState?.hasRolled) return;
    playSound("click");

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const moves = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];

    const updatedState = {
      ...gameState,
      dice: [d1, d2],
      hasRolled: true,
      movesLeft: moves,
    };

    saveLocalGameState(updatedState);

    if (gameRef && !isLocalActive) {
      try {
        await updateDoc(gameRef, {
          dice: [d1, d2],
          hasRolled: true,
          movesLeft: moves,
        });
      } catch (e) {
        console.error("Backgammon roll error:", e);
      }
    }
  }

  // End turn helper or switch turn
  async function endTurn() {
    if (!gameState || !isMyTurn) return;
    playSound("click");

    const nextTurn = gameState.turn === gameState.player1 ? gameState.player2 : gameState.player1;
    const updatedState = {
      ...gameState,
      turn: nextTurn,
      hasRolled: false,
      movesLeft: [],
    };

    saveLocalGameState(updatedState);
    setSelected(null);

    if (gameRef && !isLocalActive) {
      try {
        await updateDoc(gameRef, {
          turn: nextTurn,
          hasRolled: false,
          movesLeft: [],
        });
      } catch (e) {
        console.error("Backgammon endTurn error:", e);
      }
    }
  }

  // Check if player has all checkers in their home zone
  function checkAllInHome(player: string, points: CheckerPoint[], barCount: number): boolean {
    if (barCount > 0) return false;

    const isP1 = player === gameState?.player1;
    const homeStart = isP1 ? HOME_START_P1 : HOME_START_P2;
    const homeEnd = isP1 ? HOME_END_P1 : HOME_END_P2;

    for (let i = 0; i < 24; i++) {
      if (points[i].player === player && points[i].count > 0) {
        if (i < homeStart || i > homeEnd) {
          return false;
        }
      }
    }
    return true;
  }

  // Determine legal destination list for highlighted clicks
  function getLegalMoves(from: number | "bar"): number[] {
    if (!gameState || !currentUser) return [];
    
    const pId = currentUser.id;
    const isP1 = pId === gameState.player1;
    const barCount = (gameState.bar || {})[pId] || 0;

    // Must solve bar check first
    if (from !== "bar" && barCount > 0) return [];

    const moves: number[] = gameState.movesLeft.filter((val, idx, self) => self.indexOf(val) === idx);
    const legalDestinations: number[] = [];

    moves.forEach((moveVal) => {
      // White moves from indices 23 to 0
      // Black moves from indices 0 to 23
      let toIdx = 0;
      if (from === "bar") {
        toIdx = isP1 ? 24 - moveVal : moveVal - 1;
      } else {
        toIdx = isP1 ? (from as number) - moveVal : (from as number) + moveVal;
      }

      // Check board boundaries (Beard Off Option)
      if (isP1 && toIdx < 0) {
        if (checkAllInHome(pId, gameState.points, barCount)) {
          const distance = (from as number) + 1;
          if (moveVal > distance) {
            let hasFurther = false;
            for(let i = (from as number) + 1; i <= HOME_END_P1; i++) {
              if (gameState.points[i].player === pId && gameState.points[i].count > 0) {
                hasFurther = true; break;
              }
            }
            if (hasFurther) return;
          }
          legalDestinations.push(-2); // -2 code indicates OFF board option
        }
        return;
      }
      if (!isP1 && toIdx >= 24) {
        if (checkAllInHome(pId, gameState.points, barCount)) {
          const distance = 24 - (from as number);
          if (moveVal > distance) {
            let hasFurther = false;
            for(let i = (from as number) - 1; i >= HOME_START_P2; i--) {
              if (gameState.points[i].player === pId && gameState.points[i].count > 0) {
                hasFurther = true; break;
              }
            }
            if (hasFurther) return;
          }
          legalDestinations.push(-2);
        }
        return;
      }

      // Point blocks check: point shouldn't have >= 2 opponents
      const targetPoint = gameState.points[toIdx];
      const opponent = isP1 ? gameState.player2 : gameState.player1;
      if (targetPoint.player === opponent && targetPoint.count >= 2) {
        return; // blocked
      }

      legalDestinations.push(toIdx);
    });

    return legalDestinations;
  };

  // Helper to check if ANY move is possible for the current player
  const hasAnyLegalMoves = useMemo(() => {
    if (!gameState || !currentUser || !gameState.hasRolled || gameState.movesLeft.length === 0) return true;
    
    const pId = currentUser.id;
    const barCount = (gameState.bar || {})[pId] || 0;
    
    if (barCount > 0) {
      return getLegalMoves("bar").length > 0;
    }
    
    for (let i = 0; i < 24; i++) {
      if (gameState.points[i].player === pId && gameState.points[i].count > 0) {
        if (getLegalMoves(i).length > 0) return true;
      }
    }
    return false;
  }, [gameState, currentUser, getLegalMoves]);

  useEffect(() => {
    if (gameState && isMyTurn && gameState.hasRolled && !hasAnyLegalMoves && gameState.movesLeft.length > 0) {
      setMessage("אין מהלכים חוקיים אפשריים. התור עובר אוטומטית...");
      const timer = setTimeout(() => {
        endTurn();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasAnyLegalMoves, isMyTurn, gameState?.hasRolled, gameState?.movesLeft.length]);

  const legalMoves = useMemo(() => {
    if (selected === null) return [];
    return getLegalMoves(selected);
  }, [selected, gameState]);

  const isLegalDestination = (idx: number) => {
    return legalMoves.includes(idx);
  };

  const isLegalOff = () => {
    return legalMoves.includes(-2);
  };

  // Perform a move
  async function handleMove(from: number | "bar", to: number | "off") {
    if (!gameState || !currentUser) return;
    playSound("click");

    const pId = currentUser.id;
    const isP1 = pId === gameState.player1;
    const oppId = isP1 ? gameState.player2 : gameState.player1;

    let moveValUsed = 0;
    if (from === "bar") {
      moveValUsed = isP1 ? 24 - (to as number) : (to as number) + 1;
    } else if (to === "off") {
      // Find the smallest move value that allows bearing off this piece
      // White home: 0-5. Black home: 18-23.
      const distance = isP1 ? (from as number) + 1 : 24 - (from as number);
      const exactMove = gameState.movesLeft.find((m) => m === distance);
      if (exactMove) {
        moveValUsed = exactMove;
      } else {
        // Can bear off with an over-roll if no exact matches exist
        const largerMoves = gameState.movesLeft.filter((m) => m > distance);
        if (largerMoves.length > 0) {
          moveValUsed = Math.min(...largerMoves);
        }
      }
    } else {
      moveValUsed = isP1 ? (from as number) - (to as number) : (to as number) - (from as number);
    }

    if (moveValUsed === 0) return;

    try {
      const pts = gameState.points.map((p) => ({ ...p }));
      const currentBar = { ...(gameState.bar || {}) };
      const currentOff = { ...(gameState.off || {}) };

      // 1. Remove checker from source
      if (from === "bar") {
        currentBar[pId] = Math.max(0, currentBar[pId] - 1);
      } else {
        const fromPt = pts[from as number];
        fromPt.count--;
        if (fromPt.count === 0) {
          fromPt.player = null;
        }
      }

      // 2. Put checker in destination or bear off
      if (to === "off") {
        currentOff[pId] = (currentOff[pId] || 0) + 1;
      } else {
        const toPt = pts[to as number];
        if (toPt.player === oppId && toPt.count === 1) {
          // Hit! Send opponent to bar
          toPt.player = pId;
          toPt.count = 1;
          currentBar[oppId] = (currentBar[oppId] || 0) + 1;
          playSound("success");
        } else {
          toPt.player = pId;
          toPt.count++;
        }
      }

      // 3. Consume the move
      const newMovesLeft = [...gameState.movesLeft];
      const moveIdx = newMovesLeft.indexOf(moveValUsed);
      if (moveIdx !== -1) {
        newMovesLeft.splice(moveIdx, 1);
      }

      // 4. Check for victory
      let status = gameState.status;
      let winner = gameState.winner;
      let newScores = { ...(gameState.scores || { [gameState.player1]: 0, [gameState.player2]: 0 }) };
      
      if (currentOff[pId] >= 15) {
        status = "finished";
        winner = pId;
        newScores[pId] = (newScores[pId] || 0) + 1;
        playSound("success");
      }

      let updatedTurn = gameState.turn;
      let updatedRolled = gameState.hasRolled;
      
      if (newMovesLeft.length === 0 && status !== 'finished') {
        updatedTurn = gameState.turn === gameState.player1 ? gameState.player2 : gameState.player1;
        updatedRolled = false;
      }

      const updatedState: BackgammonState = {
        ...gameState,
        points: pts,
        bar: currentBar,
        off: currentOff,
        movesLeft: newMovesLeft,
        status,
        winner,
        turn: updatedTurn,
        hasRolled: updatedRolled,
        scores: newScores,
      };

      saveLocalGameState(updatedState);
      setSelected(null);

      if (gameRef && !isLocalActive) {
        await updateDoc(gameRef, {
          points: pts,
          bar: currentBar,
          off: currentOff,
          movesLeft: newMovesLeft,
          status,
          winner,
          turn: updatedTurn,
          hasRolled: updatedRolled,
          scores: newScores,
        });
      }
    } catch (e) {
      console.error("Backgammon Move Error:", e);
    }
  }

  // Click on points handler
  function handlePointClick(idx: number) {
    if (!isMyTurn || !gameState?.hasRolled) return;

    if (selected === idx) {
      setSelected(null);
      return;
    }

    if (isLegalDestination(idx)) {
      handleMove(selected!, idx);
      return;
    }

    // Try selecting point
    const target = gameState.points[idx];
    if (target.player === currentUser?.id && target.count > 0) {
      if ((gameState.bar || {})[currentUser.id] > 0) {
        setMessage("עליך להחזיר תחילה את השחקנים מהקופה.");
        return;
      }
      setSelected(idx);
      setMessage("");
    }
  }

  // Reset core game board fully
  async function resetGame() {
    if (!currentUser || !partner || !gameState) return;
    playSound("click");
    setSelected(null);
    setMessage("");

    const initialPoints = createInitialPoints(currentUser.id, partner.id);
    const updatedState: BackgammonState = {
      ...gameState,
      player1: currentUser.id,
      player2: partner.id,
      turn: currentUser.id,
      points: initialPoints,
      dice: [3, 5],
      hasRolled: false,
      movesLeft: [],
      bar: {
        [currentUser.id]: 0,
        [partner.id]: 0,
      },
      off: {
        [currentUser.id]: 0,
        [partner.id]: 0,
      },
      status: "active",
      winner: null,
      punishmentText: null,
    };

    setMissionSent(false);
    setMissionText("");

    saveLocalGameState(updatedState);

    if (gameRef && !isLocalActive) {
      try {
        await updateDoc(gameRef, {
          player1: currentUser.id,
          player2: partner.id,
          turn: currentUser.id,
          points: initialPoints,
          dice: [3, 5],
          hasRolled: false,
          movesLeft: [],
          bar: {
            [currentUser.id]: 0,
            [partner.id]: 0,
          },
          off: {
            [currentUser.id]: 0,
            [partner.id]: 0,
          },
          status: "active",
          winner: null,
          punishmentText: null,
        });
      } catch (e) {
        console.error("Backgammon reset error:", e);
      }
    }
  }

  const resetScoresAndGame = async () => {
    if (!currentUser || !partner || !gameState) return;
    playSound("click");
    setSelected(null);
    setMessage("");
    setMissionSent(false);
    setMissionText("");

    const initialPoints = createInitialPoints(currentUser.id, partner.id);
    const updatedState: BackgammonState = {
      ...gameState,
      player1: currentUser.id,
      player2: partner.id,
      turn: currentUser.id,
      points: initialPoints,
      dice: [3, 5],
      hasRolled: false,
      movesLeft: [],
      bar: {
        [currentUser.id]: 0,
        [partner.id]: 0,
      },
      off: {
        [currentUser.id]: 0,
        [partner.id]: 0,
      },
      status: "active",
      winner: null,
      punishmentText: null,
      scores: {
        [currentUser.id]: 0,
        [partner.id]: 0,
      },
    };

    saveLocalGameState(updatedState);

    if (gameRef && !isLocalActive) {
      try {
        await updateDoc(gameRef, {
          player1: currentUser.id,
          player2: partner.id,
          turn: currentUser.id,
          points: initialPoints,
          dice: [3, 5],
          hasRolled: false,
          movesLeft: [],
          bar: {
            [currentUser.id]: 0,
            [partner.id]: 0,
          },
          off: {
            [currentUser.id]: 0,
            [partner.id]: 0,
          },
          status: "active",
          winner: null,
          punishmentText: null,
          scores: updatedState.scores,
        });
      } catch (e) {
        console.error("Backgammon reset scores error:", e);
      }
    }
  };

  const handleSendPunishment = async () => {
    if (!missionText.trim() || missionSent || !currentUser || !partner || !gameId) return;

    try {
      if (false) {
        if (gameState) {
          const updatedState = { ...gameState, punishmentText: missionText.trim() };
          setLocalGameState(updatedState);
          localStorage.setItem("dateapp_backgammon_game", JSON.stringify(updatedState));
        }
        setMissionSent(true);
        import("sonner").then(({ toast }) =>
          toast.success("משימת העונש נשמרה מקומית!"),
        );
        return;
      }

      await sendMission({
        title: "משימת עונש (שש-בש)",
        shortText: missionText.trim(),
        fullText: missionText.trim(),
        sender: currentUser.id,
        receiver: partner.id,
        status: "sent",
        isMandatory: true,
      });
      await updateDoc(doc(db, "games", `backgammon_${gameId}`), {
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

  const renderCheckers = (point: CheckerPoint, isTop: boolean) => {
    if (!point.player || point.count === 0) return null;
    const visibleCount = Math.min(point.count, 5);
    const colorClass = point.player === gameState?.player1 ? "white" : "black";

    const stackClass = isTop
      ? "flex flex-col items-center gap-0.5 pt-4 h-full"
      : "flex flex-col-reverse items-center gap-0.5 pb-4 h-full justify-end";

    return (
      <div className={stackClass}>
        {Array.from({ length: visibleCount }).map((_, i) => (
          <span key={i} className={`checker ${colorClass}`} />
        ))}
        {point.count > 5 && (
          <span className="more">+{point.count - 5}</span>
        )}
      </div>
    );
  };

  const renderPoint = (idx: number, isTop: boolean) => {
    if (!gameState) return null;
    const point = gameState.points[idx];
    const isSelected = selected === idx;
    const isLegal = isLegalDestination(idx);
    const pointColorClass = idx % 2 === 0 ? "point-red" : "point-gold";
    const displayNum = isPlayer1 ? idx + 1 : 24 - idx;

    return (
      <button
        key={idx}
        onClick={() => handlePointClick(idx)}
        className={`point ${isSelected ? "selected" : ""} ${isLegal ? "legal" : ""} ${pointColorClass} ${isTop ? "is-top" : "is-bottom"}`}
      >
        {/* Real-looking SVG Triangle point */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <svg viewBox="0 0 100 240" preserveAspectRatio="none" className="w-full h-full">
            <polygon
              points={isTop ? "0,0 100,0 50,240" : "50,0 100,240 0,240"}
              fill="currentColor"
            />
          </svg>
        </div>

        <span className="point-number z-20 font-bold">{displayNum}</span>
        
        <div className="relative z-10 w-full h-full">
          {renderCheckers(point, isTop)}
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-center min-h-[300px]" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Dice5 className="animate-spin text-amber-600" size={32} />
          <p>טוען לוח שש בש...</p>
        </div>
      </div>
    );
  }

  if (!gameState || !currentUser || !partner) {
    return (
      <div className="flex items-center justify-center p-8 text-center min-h-[300px]" dir="rtl">
        <div className="text-red-500">שגיאה בטעינת לוח שש בש.</div>
      </div>
    );
  }

  const p1Name = (gameState.playerNames || {})[gameState.player1] || "לבן";
  const p2Name = (gameState.playerNames || {})[gameState.player2] || "שחור";

  return (
    <section className="backgammon-section" dir="rtl">
      <div className="game-card">
        <div className="header">
          <div>
            <h2>שש בש זוגי</h2>
            <p>שחקו שש בש קלאסי ויוקרתי ביחד בזמן אמת</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {currentUser?.id === 'boaz' && (
              <button onClick={resetGame} className="reset-btn flex items-center justify-center gap-1">
                <RotateCcw size={16} />
                משחק חדש
              </button>
            )}
            {currentUser?.id === 'boaz' && (
              <div className="flex flex-col gap-2">
                <button 
                  onClick={async () => {
                    if (gameRef && !isLocalActive && gameState && currentUser) {
                      const newScores = { ...gameState.scores };
                      newScores[currentUser.id] = (newScores[currentUser.id] || 0) + 2;
                      await updateDoc(gameRef, { scores: newScores });
                      setLocalGameState({ ...gameState, scores: newScores });
                    }
                  }} 
                  className="reset-btn flex items-center justify-center gap-1 bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30"
                >
                  + 2 נקודות
                </button>
                <button onClick={resetScoresAndGame} className="reset-btn flex items-center justify-center gap-1 bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30">
                  איפוס ניקוד
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center mb-4">
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-xs font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1 cursor-pointer border border-amber-500/30 w-fit"
          >
            <HelpCircle size={14} />
            {showExplanation ? "הסתר חוקי משחק" : "איך משחקים?"}
          </button>
        </div>

        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full text-right leading-relaxed text-sm bg-slate-900/50 border border-slate-700/60 rounded-2xl p-4 mb-4 shadow-inner overflow-hidden"
            >
              <h4 className="font-extrabold text-amber-400 mb-2 flex items-center gap-1.5 text-xs">
                <BookOpen size={14} className="text-amber-500" />
                חוקי המשחק - שש בש:
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300">
                <li><strong className="text-amber-200">המטרה:</strong> להעביר את כל 15 החיילים שלכם ללוח הבית (הרביע האחרון) ואז להוציאם מהלוח לפני היריב.</li>
                <li><strong className="text-amber-200">צעדים:</strong> מגלגלים את הקוביות ומתקדמים בהתאם. דאבל מעניק מהלכים כפולים (4 מהלכים!).</li>
                <li><strong className="text-amber-200">אכילת חייל:</strong> חייל בודד במשבצת הוא "חשוף". אם חיילו של יריב נוחת עליו, הוא "נאכל" ועובר לבר האמצעי (הקופה).</li>
                <li><strong className="text-amber-200">חזרה למשחק:</strong> חייל שבקופה חייב להיכנס מחדש דרך לוח הבית של היריב לפני שתוכל להזיז את שאר חייליך.</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-4 w-full mb-6">
          <div
            className={`p-3 rounded-2xl border-2 transition-all ${gameState.turn === gameState.player1 ? "border-[#FF6B6B] bg-[#FF6B6B]/10" : "border-transparent bg-slate-800/50"} text-center`}
          >
            <span
              className={`block text-xs font-bold mb-1 ${gameState.turn === gameState.player1 ? "text-[#FF6B6B]" : "text-slate-400"}`}
            >
              {p1Name} (לבן)
            </span>
            <strong className="block text-2xl text-white font-black">
              {gameState.scores?.[gameState.player1] ?? 0}
            </strong>
          </div>
          <div
            className={`p-3 rounded-2xl border-2 transition-all ${gameState.turn === gameState.player2 ? "border-indigo-500 bg-indigo-500/10" : "border-transparent bg-slate-800/50"} text-center`}
          >
            <span
              className={`block text-xs font-bold mb-1 ${gameState.turn === gameState.player2 ? "text-indigo-400" : "text-slate-400"}`}
            >
              {p2Name} (שחור)
            </span>
            <strong className="block text-2xl text-white font-black">
              {gameState.scores?.[gameState.player2] ?? 0}
            </strong>
          </div>
        </div>

        {gameState.status === "finished" && gameState.winner === currentUser?.id && (
          <div className="mb-6 w-full max-w-sm mx-auto bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col items-center">
            <h3 className="font-bold text-amber-400 mb-2 flex items-center gap-2">
              <Trophy size={18} />
              שלח/י משימת עונש ל{partner?.name}!
            </h3>
            <textarea
              className="w-full text-right bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-[16px] mb-3 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
              placeholder="מה הם צריכים לעשות? (למשל: לשלוח תמונה מביכה)"
              value={missionText}
              onChange={(e) => setMissionText(e.target.value)}
              rows={2}
            />
            <button
              onClick={handleSendPunishment}
              disabled={missionSent || !missionText.trim()}
              className="w-full bg-amber-500 text-white rounded-xl py-2 font-bold text-sm hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {missionSent ? "נשלח בהצלחה!" : "שלח עונש"}
            </button>
          </div>
        )}

        <div className="info-grid mb-6">
          <div className={`player-box ${gameState.turn === gameState.player1 ? "active" : ""}`}>
            <span>שחקן לבן קופה: ({(gameState.bar || {})[gameState.player1] || 0})</span>
            <strong>{p1Name}</strong>
          </div>

          <div className="dice-box flex flex-col items-center justify-center gap-2">
            <span className="text-xs text-amber-200">קוביות משחק</span>
            <div className="flex gap-2">
              <span className="w-10 h-10 bg-white border-2 border-slate-300 text-slate-800 rounded-xl flex items-center justify-center font-bold text-xl shadow">
                {gameState.dice[0]}
              </span>
              <span className="w-10 h-10 bg-white border-2 border-slate-300 text-slate-800 rounded-xl flex items-center justify-center font-bold text-xl shadow">
                {gameState.dice[1]}
              </span>
            </div>
          </div>

          <div className={`player-box ${gameState.turn === gameState.player2 ? "active" : ""}`}>
            <span>שחקן שחור קופה: ({(gameState.bar || {})[gameState.player2] || 0})</span>
            <strong>{p2Name}</strong>
          </div>
        </div>

        <div className="turn-box">
          {gameState.status === "finished" ? (
            <div className="flex items-center justify-center gap-1.5 text-yellow-400 font-bold text-base">
              <Trophy size={18} />
              <span>🎉 המשחק הסתיים! המנצח הוא {gameState.winner === gameState.player1 ? p1Name : p2Name}!</span>
            </div>
          ) : (
            <div>
              {isMyTurn ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[#fbbf24] font-bold text-base flex items-center gap-1 animate-pulse">
                    <Sparkles size={16} />
                    תורכם המלא כעת!
                  </span>
                  {!gameState.hasRolled ? (
                    <button onClick={rollDice} className="px-5 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-white font-extrabold shadow mt-2 cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0">
                      🎲 גלגלו קוביות!
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs">מהלכים שנשארו: [{gameState.movesLeft.join(", ")}]</span>
                      <button onClick={endTurn} className="px-4 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold cursor-pointer">
                        סיום תור
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p>ממתינים ש-{gameState.turn === gameState.player1 ? p1Name : p2Name} ישחק...</p>
              )}
            </div>
          )}
        </div>

        {gameState.status === "finished" &&
          gameState.winner !== currentUser?.id &&
          gameState.punishmentText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full justify-center max-w-sm mx-auto bg-red-950/40 border-2 border-red-500/50 rounded-3xl p-6 mt-4 mb-4 shadow-xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse"></div>
              <h3 className="font-black text-red-400 text-xl mb-2 flex items-center justify-center gap-2">
                <span>🚨</span> משימת עונש התקבלה!
              </h3>
              <p className="text-red-200/80 font-medium mb-4 text-sm">
                הפסדת, ולכן {partner?.name} החליט לפנק אותך בעונש:
              </p>
              <div className="bg-black/40 border border-red-500/30 p-4 rounded-xl shadow-inner font-bold text-lg text-white">
                {gameState.punishmentText}
              </div>
              <p className="text-xs text-red-400/80 mt-4 font-bold uppercase tracking-widest">
                ניתן למצוא את המשימה בתיבת משימות
              </p>
            </motion.div>
          )}

        {message && (
          <div className="bg-amber-50 border border-amber-200/50 text-amber-900 text-xs py-2 px-4 rounded-xl mb-4 text-center">
            {message}
          </div>
        )}

        <div className="flex justify-between items-center mb-4 px-2">
          {/* Bear off clickable option for home-board bearing check */}
          {selected !== null && isLegalOff() && (
            <button
              onClick={() => handleMove(selected!, "off")}
              className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-2xl w-full text-center font-bold text-sm shadow animate-bounce cursor-pointer flex items-center justify-center gap-1"
            >
              <span>🚪</span> הוצאת חייל החוצה (Bear Off)
            </button>
          )}
        </div>

        {/* Real Premium Backgammon Board Layout */}
        <div className="board" dir="ltr">
          {/* Left Board Wing */}
          <div className="board-wing left-wing">
            <div className="wing-row top">
              {topRowLeft.map((idx) => renderPoint(idx, true))}
            </div>
            <div className="wing-row bottom">
              {bottomRowLeft.map((idx) => renderPoint(idx, false))}
            </div>
          </div>

          {/* Central Vertical Wooden Divider Column (the Bar!) */}
          <div className="central-bar-vertical">
            <span className="bar-label">קופה</span>
            <div className="bar-stacks">
              {/* White eaten pieces pile */}
              <div
                className={`bar-pile white-pile ${selected === "bar" && currentUser.id === gameState.player1 ? "active-pile" : ""}`}
                onClick={() =>
                  isMyTurn &&
                  gameState.bar[gameState.player1] > 0 &&
                  setSelected(selected === "bar" ? null : "bar")
                }
              >
                {Array.from({ length: Math.min((gameState.bar || {})[gameState.player1] || 0, 3) }).map((_, i) => (
                  <span key={i} className="mini-checker white animate-pulse" />
                ))}
                {((gameState.bar || {})[gameState.player1] || 0) > 3 && (
                  <span className="tray-overflow">+{(gameState.bar || {})[gameState.player1] - 3}</span>
                )}
                {((gameState.bar || {})[gameState.player1] || 0) > 0 && (
                  <span className="bar-player-label">לבן ({(gameState.bar || {})[gameState.player1]})</span>
                )}
              </div>

              {/* Black eaten pieces pile */}
              <div
                className={`bar-pile black-pile ${selected === "bar" && currentUser.id === gameState.player2 ? "active-pile" : ""}`}
                onClick={() =>
                  isMyTurn &&
                  gameState.bar[gameState.player2] > 0 &&
                  setSelected(selected === "bar" ? null : "bar")
                }
              >
                {Array.from({ length: Math.min((gameState.bar || {})[gameState.player2] || 0, 3) }).map((_, i) => (
                  <span key={i} className="mini-checker black animate-pulse" />
                ))}
                {((gameState.bar || {})[gameState.player2] || 0) > 3 && (
                  <span className="tray-overflow">+{(gameState.bar || {})[gameState.player2] - 3}</span>
                )}
                {((gameState.bar || {})[gameState.player2] || 0) > 0 && (
                  <span className="bar-player-label">שחור ({(gameState.bar || {})[gameState.player2]})</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Board Wing (Active User's Home Board!) */}
          <div className="board-wing right-wing">
            <div className="wing-row top">
              {topRowRight.map((idx) => renderPoint(idx, true))}
            </div>
            <div className="wing-row bottom">
              {bottomRowRight.map((idx) => renderPoint(idx, false))}
            </div>
          </div>

          {/* Side Wooden Groove Tray for Bear-out Checkers! */}
          <div className="bear-out-tray">
            <div className="tray-section p1-tray">
              <span className="tray-label">לבן בחוץ</span>
              <div className="tray-slots">
                {Array.from({ length: Math.min((gameState.off || {})[gameState.player1] || 0, 6) }).map((_, i) => (
                  <div key={i} className="flat-checker white" />
                ))}
                {((gameState.off || {})[gameState.player1] || 0) > 6 && (
                  <span className="tray-overflow">+{(gameState.off || {})[gameState.player1] - 6}</span>
                )}
              </div>
              <span className="count-label">{(gameState.off || {})[gameState.player1] || 0}/15</span>
            </div>

            <div className="tray-section p2-tray">
              <span className="tray-label">שחור בחוץ</span>
              <div className="tray-slots">
                {Array.from({ length: Math.min((gameState.off || {})[gameState.player2] || 0, 6) }).map((_, i) => (
                  <div key={i} className="flat-checker black" />
                ))}
                {((gameState.off || {})[gameState.player2] || 0) > 6 && (
                  <span className="tray-overflow">+{(gameState.off || {})[gameState.player2] - 6}</span>
                )}
              </div>
              <span className="count-label">{(gameState.off || {})[gameState.player2] || 0}/15</span>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-slate-400">
          מזהה שולחן: <strong>{gameId}</strong>
        </div>
      </div>

      <style>{`
        .backgammon-section {
          width: 100%;
          padding: 24px 10px;
          background: linear-gradient(135deg, #120701, #251204);
          font-family: system-ui, -apple-system, sans-serif;
          box-sizing: border-box;
          overflow-x: hidden;
          border-radius: 24px;
        }

        .game-card {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          background: #46250b; /* Glossy dark cherry mahogany wood cabinet */
          border-radius: clamp(18px, 4vw, 30px);
          padding: clamp(12px, 3vw, 24px);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75), inset 0 2px 4px rgba(255, 255, 255, 0.1);
          border: 6px solid #2a1403;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
          color: #fceade;
        }

        .header h2 {
          margin: 0;
          font-size: clamp(24px, 7vw, 34px);
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #fff;
          font-family: Georgia, serif;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .header p {
          margin: 4px 0 0;
          color: #f7d6c1;
          font-size: clamp(13px, 3.5vw, 15px);
          opacity: 0.95;
        }

        .reset-btn {
          border: none;
          border-radius: 12px;
          padding: 10px 18px;
          font-size: clamp(12px, 3vw, 14px);
          background: #ea580c;
          color: white;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);
          white-space: nowrap;
        }

        .reset-btn:hover {
          background: #f97316;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(234, 88, 12, 0.4);
        }

        .info-grid {
          display: grid;
          grid-template-columns: 2fr 1.5fr 2fr;
          gap: 10px;
        }

        .player-box,
        .dice-box {
          background: rgba(0, 0, 0, 0.25);
          border-radius: 16px;
          padding: clamp(8px, 2vw, 14px);
          border: 2px solid transparent;
          text-align: center;
          color: #f3dfd2;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.4);
        }

        .player-box.active {
          border-color: #fbbf24;
          background: rgba(245, 158, 11, 0.15);
          box-shadow: 0 0 15px rgba(245, 158, 11, 0.2), inset 0 2px 8px rgba(0,0,0,0.3);
        }

        .player-box span {
          display: block;
          font-size: clamp(10px, 2.5vw, 13px);
          color: #f3dfd2;
          opacity: 0.8;
          margin-bottom: 4px;
        }

        .player-box strong {
          display: block;
          font-size: clamp(13px, 3.5vw, 20px);
          color: #ffffff;
        }

        .turn-box {
          background: rgba(0, 0, 0, 0.35);
          color: white;
          border-radius: 16px;
          padding: 12px 18px;
          margin-bottom: 18px;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .turn-box strong {
          display: block;
          margin-bottom: 4px;
          color: #fbbf24;
        }

        .turn-box p {
          margin: 0;
          font-size: 14px;
          color: #f3dfd2;
        }

        /* Premium classic backgammon board playing field in CSS */
        .board {
          display: grid;
          grid-template-columns: 6fr minmax(28px, 1.2fr) 6fr minmax(40px, 1.4fr);
          background: #063c24; /* Authentic rich green felt */
          border-radius: clamp(12px, 3vw, 20px);
          padding: 12px;
          box-shadow: inset 0 0 35px rgba(0,0,0,0.85);
          border: 8px solid #231204; /* Inner wood frame */
          width: 100%;
          max-width: 100%;
          gap: 4px;
        }

        .board-wing {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          gap: 24px;
        }

        .wing-row {
          display: grid;
          grid-template-columns: repeat(6, 1fr) !important;
          gap: 2px;
          width: 100%;
        }

        .point {
          min-height: clamp(110px, 26vw, 184px);
          border: none;
          background: transparent !important;
          cursor: pointer;
          overflow: visible;
          padding: 0;
          transition: 0.15s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          width: 100%;
          position: relative;
        }

        .point.is-bottom {
          justify-content: flex-end;
        }

        .point-red {
          color: #a11f1f; /* Authentic crimson points */
        }

        .point-gold {
          color: #dfbe7b; /* Authentic luxurious yellow sand points */
        }

        .point:hover {
          filter: brightness(1.2) contrast(1.1);
        }

        .point.selected {
          filter: brightness(1.3) contrast(1.155);
        }

        .point.legal {
          outline: 2px dashed #10b981;
          border-radius: 4px;
          z-index: 10;
        }

        .point-number {
          font-size: clamp(8px, 2.4vw, 11px);
          font-weight: 800;
          color: rgba(255, 255, 255, 0.35);
          z-index: 5;
          position: absolute;
        }

        .point.is-top .point-number {
          top: 4px;
        }

        .point.is-bottom .point-number {
          bottom: 4px;
        }

        /* Traditional high finish wooden vertical divider column -- The Bar */
        .central-bar-vertical {
          background: linear-gradient(90deg, #321603, #462106, #2d1302);
          border-left: 2px solid #1c0b01;
          border-right: 2px solid #1c0b01;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 12px 2px;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
          height: 100%;
        }

        .bar-label {
          font-size: clamp(8px, 2vw, 11px);
          font-weight: 900;
          color: #dfbe7b;
          text-shadow: 0 1px 2px rgba(0,0,0,0.8);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .bar-stacks {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
          align-items: center;
          justify-content: center;
          flex: 1;
        }

        .bar-pile {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 4px 2px;
          border-radius: 8px;
          width: 100%;
          cursor: pointer;
          transition: background 0.2s;
        }

        .bar-pile:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .bar-pile.active-pile {
          background: rgba(245, 158, 11, 0.15);
          outline: 2px solid #fbbf24;
        }

        .bar-player-label {
          font-size: 8px;
          font-weight: bold;
          color: #bf8050;
          margin-top: 2px;
          white-space: nowrap;
          text-align: center;
        }

        /* Beautiful glossy marble & wooden textures for checkers */
        .checker {
          width: clamp(14px, 4.4vw, 32px);
          height: clamp(14px, 4.4vw, 32px);
          border-radius: 50%;
          display: block;
          position: relative;
          transition: transform 0.1s ease;
        }

        .checker::after {
          content: '';
          position: absolute;
          inset: clamp(3px, 1vw, 5px);
          border-radius: 50%;
          border: 1px dashed rgba(255,255,255,0.15);
        }

        .checker.white {
          background: radial-gradient(circle at 35% 35%, #ffffff 0%, #e8e3dc 50%, #beb5a5 100%);
          box-shadow: 0 4px 8px rgba(0,0,0,0.55), inset 0 -3px 5px rgba(0,0,0,0.22), inset 0 3px 5px rgba(255,255,255,0.8);
          border: 1px solid #cfc4b4;
        }

        .checker.white::after {
          border-color: rgba(0,0,0,0.1);
        }

        .checker.black {
          background: radial-gradient(circle at 35% 35%, #3d3d3d 0%, #1e1e1e 50%, #000000 100%);
          box-shadow: 0 4px 8px rgba(0,0,0,0.65), inset 0 -3px 5px rgba(255,255,255,0.06), inset 0 3px 5px rgba(0,0,0,0.5);
          border: 1px solid #1a1a1a;
        }

        /* Small version for Eaten checkers stack */
        .mini-checker {
          width: clamp(12px, 3.5vw, 22px);
          height: clamp(12px, 3.5vw, 22px);
          border-radius: 50%;
          display: block;
          box-shadow: 0 2px 4px rgba(0,0,0,0.4);
        }

        .mini-checker.white {
          background: radial-gradient(circle at 35% 35%, #ffffff, #beb5a5);
          border: 1px solid #bbb;
        }

        .mini-checker.black {
          background: radial-gradient(circle at 35% 35%, #3d3d3d, #000);
          border: 1px solid #111;
        }

        /* Beautiful Bear-Off Wooden Slots Tray on the Right */
        .bear-out-tray {
          background: linear-gradient(180deg, #150a02, #2c1304);
          border-left: 2px solid #000;
          padding: 8px 3px;
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          align-items: center;
          height: 100%;
          box-shadow: inset 0 0 15px rgba(0,0,0,0.9);
          border-radius: 4px;
        }

        .tray-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          flex: 1;
          justify-content: center;
        }

        .tray-section.p1-tray {
          border-bottom: 2px solid rgba(0, 0, 0, 0.4);
        }

        .tray-label {
          font-size: 8px;
          font-weight: bold;
          color: #bf8050;
          margin-bottom: 4px;
          text-align: center;
        }

        .tray-slots {
          display: flex;
          flex-direction: column-reverse;
          gap: 1.5px;
          background: rgba(0, 0, 0, 0.45);
          padding: 6px 4px;
          border-radius: 4px;
          min-height: 48px;
          justify-content: flex-start;
          align-items: center;
          width: 90%;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .flat-checker {
          width: clamp(14px, 3vw, 24px);
          height: 5px;
          border-radius: 2px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }

        .flat-checker.white {
          background: linear-gradient(90deg, #fff, #dadada);
          border-bottom: 1.5px solid #999;
        }

        .flat-checker.black {
          background: linear-gradient(90deg, #333, #000);
          border-bottom: 1.5px solid #111;
        }

        .tray-overflow {
          font-size: 8px;
          font-weight: 900;
          color: #fbbf24;
        }

        .count-label {
          font-size: 9px;
          font-weight: bold;
          color: #fff;
          margin-top: 4px;
        }

        .more {
          background: rgba(239, 68, 68, 0.95);
          color: #fff;
          font-size: clamp(8px, 1.8vw, 10px);
          font-weight: 800;
          border-radius: 999px;
          padding: 1px 4px;
          margin-top: 2px;
          z-index: 10;
          text-align: center;
        }

        /* Mobile Optimization: Force board aspect-ratio or wrap on tiny phones */
        @media (max-width: 640px) {
          .board {
            grid-template-columns: 6fr minmax(18px, 1fr) 6fr minmax(28px, 1.2fr);
            padding: 4px;
            border-width: 4px;
          }
          .board-wing {
            gap: 10px;
          }
          .point {
            min-height: clamp(85px, 20vw, 130px);
          }
          .checker {
            width: clamp(10px, 3.2vw, 22px);
            height: clamp(10px, 3.2vw, 22px);
          }
          .mini-checker {
            width: 10px;
            height: 10px;
          }
        }

        @media (max-width: 520px) {
          .backgammon-section {
            padding: 12px 4px;
          }

          .game-card {
            padding: 8px;
            border-width: 4px;
          }

          .header {
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }

          .reset-btn {
            width: 100%;
          }

          .turn-box {
            padding: 10px;
            font-size: 13px;
          }

          .info-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>
    </section>
  );
}
