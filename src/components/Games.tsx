import React, { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowRight,
  Gamepad2,
  Grid3X3,
  Circle,
  Dice5,
  Boxes,
  RotateCcw,
  Bell,
} from "lucide-react";
import { doc, runTransaction } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "../firebase";
import { useApp } from "../lib/store";
import { useWaitingGames } from "./Layout";
import { observeDocument, createDocumentIfMissing } from "../lib/realtime";
const ConnectFour = lazy(() =>
  import("./ConnectFour").then((module) => ({ default: module.ConnectFour })),
);
const DotsAndBoxes = lazy(() =>
  import("./DotsAndBoxes").then((module) => ({ default: module.DotsAndBoxes })),
);
const Backgammon = lazy(() =>
  import("./Backgammon").then((module) => ({ default: module.Backgammon })),
);
type Game = "tictactoe" | "connectfour" | "dotsandboxes" | "backgammon";
type Board = {
  board: string[];
  turn: string;
  status: "playing" | "won" | "draw";
  winner: string | null;
  winningLine: number[];
  updatedAt: number;
  scores: Record<string, number>;
};
const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
export function advanceTicTacToe(
  state: Board,
  index: number,
  player: string,
  partner: string,
): Board {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index > 8 ||
    state.status !== "playing" ||
    state.turn !== player ||
    state.board[index]
  )
    throw new Error("הלוח השתנה או שזה לא התור שלך");
  const board = [...state.board];
  board[index] = player;
  const winningLine =
    lines.find((line) => line.every((cell) => board[cell] === player)) || [];
  const won = winningLine.length > 0;
  return {
    ...state,
    board,
    turn: partner,
    status: won ? "won" : board.every(Boolean) ? "draw" : "playing",
    winner: won ? player : null,
    winningLine,
    scores: {
      ...state.scores,
      [player]: (state.scores[player] || 0) + (won ? 1 : 0),
    },
    updatedAt: Date.now(),
  };
}
export function TicTacToe() {
  const { currentUser, partner } = useApp();
  const [state, setState] = useState<Board | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const id =
    currentUser && partner
      ? `tictactoe_${[currentUser.id, partner.id].sort().join("_")}`
      : null;
  const initial = (): Board => ({
    board: Array(9).fill(""),
    turn: "boaz",
    status: "playing",
    winner: null,
    winningLine: [],
    updatedAt: Date.now(),
    scores: { boaz: 0, mishel: 0 },
  });
  useEffect(() => {
    if (!id) return;
    const ref = doc(db, "games", id);
    void createDocumentIfMissing(ref, initial()).catch(() => setError(true));
    return observeDocument(
      ref,
      (snapshot) => {
        const fromCache = snapshot.metadata.fromCache;
        if (snapshot.exists()) {
          setState(snapshot.data() as Board);
          setError(false);
        } else if (!fromCache) {
          void createDocumentIfMissing(ref, initial()).catch(() => setError(true));
        }
      },
      () => setError(true),
    );
  }, [id]);
  const move = async (index: number) => {
    if (!id || !currentUser || !partner || busy) return;
    setBusy(true);
    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "games", id);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error("missing");
        transaction.set(
          ref,
          advanceTicTacToe(
            snapshot.data() as Board,
            index,
            currentUser.id,
            partner.id,
          ),
        );
      });
    } catch {
      toast.error("המהלך לא נשמר. בדקו את התור ונסו שוב.");
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!id || busy || !window.confirm("להתחיל סיבוב חדש לשניכם?")) return;
    setBusy(true);
    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "games", id);
        const snapshot = await transaction.get(ref);
        transaction.set(ref, {
          ...initial(),
          turn: snapshot.exists()
            ? snapshot.data().status === "won" && snapshot.data().winner
              ? snapshot.data().winner === "boaz" ? "mishel" : "boaz"
              : snapshot.data().turn === "boaz" ? "mishel" : "boaz"
            : "boaz",
          scores: snapshot.exists() ? snapshot.data().scores : initial().scores,
        });
      });
    } catch {
      toast.error("לא ניתן להתחיל סיבוב כרגע");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel tic-game">
      {error && <p className="notice error">מחדשים את החיבור למשחק…</p>}
      {!state ? (
        <div role={error ? "alert" : "status"} className="space-y-3">
          <p>{error ? "לא הצלחנו להתחבר ללוח המשחק. ננסה שוב כשהחיבור יחזור." : "טוענים את הלוח…"}</p>
          {error && <button className="button button-light" onClick={() => {
            setError(false);
            if (id) void createDocumentIfMissing(doc(db, "games", id), initial()).catch(() => setError(true));
          }}>נסה שוב</button>}
        </div>
      ) : (
        <>
          <h2>
            {state.status === "won"
              ? state.winner === currentUser?.id
                ? "ניצחת! ♡"
                : `${partner?.name} ניצח/ה!`
              : state.status === "draw"
                ? "תיקו! עוד סיבוב?"
                : state.turn === currentUser?.id
                  ? "התור שלך"
                  : `התור של ${partner?.name}`}
          </h2>
          <p>את/ה {currentUser?.id === "boaz" ? "X" : "O"}</p>
          <div className="tic-board" dir="ltr">
            {state.board.map((value, index) => (
              <button
                key={index}
                aria-label={`משבצת ${index + 1}${value ? `: ${value === "boaz" ? "X" : "O"}` : ""}`}
                disabled={
                  busy ||
                  !!value ||
                  state.turn !== currentUser?.id ||
                  state.status !== "playing"
                }
                className={state.winningLine?.includes(index) ? "winning" : ""}
                onClick={() => void move(index)}
              >
                {value ? (value === "boaz" ? "X" : "O") : ""}
              </button>
            ))}
          </div>
          <p>
            ניצחונות: {currentUser?.name}{" "}
            {state.scores[currentUser?.id || ""] || 0} · {partner?.name}{" "}
            {state.scores[partner?.id || ""] || 0}
          </p>
          <button
            className="button button-light mt-5"
            disabled={busy}
            onClick={() => void reset()}
          >
            <RotateCcw size={16} /> סיבוב חדש
          </button>
        </>
      )}
    </section>
  );
}
const games = [
  {
    id: "tictactoe",
    title: "איקס עיגול",
    text: "שלושה ברצף ורגע של ניצחון",
    icon: Grid3X3,
    color: "rose",
  },
  {
    id: "connectfour",
    title: "ארבע בשורה",
    text: "חושבים צעד אחד קדימה",
    icon: Circle,
    color: "peach",
  },
  {
    id: "dotsandboxes",
    title: "קווים וריבועים",
    text: "קו קטן, מהלך גדול",
    icon: Boxes,
    color: "sage",
  },
  {
    id: "backgammon",
    title: "שש בש",
    text: "הקלאסיקה שתמיד כיף לחזור אליה",
    icon: Dice5,
    color: "lavender",
  },
] as const;
const notificationId = (game: Game) => game === "connectfour" ? "connect4" : game;
export function Games({ listRequest = 0 }: { listRequest?: number }) {
  const [selected, setSelected] = useState<Game | null>(null);
  const waitingGames = useWaitingGames();
  useEffect(() => setSelected(null), [listRequest]);
  const isWaiting = (game: Game) => waitingGames.includes(notificationId(game));
  const waitingTitles = games.filter((game) => isWaiting(game.id));
  const orderedGames = [...games].sort((a, b) => Number(isWaiting(b.id)) - Number(isWaiting(a.id)));
  return (
    <div className="page games-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">קצת תחרות, הרבה ביחד</p>
          <h1>
            {selected
              ? games.find((game) => game.id === selected)?.title
              : "משחקים ביחד"}
          </h1>
          <p>שני מכשירים, משחק משותף אחד.</p>
        </div>
        <span className="feature-icon lavender">
          <Gamepad2 size={26} />
        </span>
      </header>
      {!selected && waitingTitles.length > 0 && (
        <section className="games-turn-summary" role="status" aria-live="polite">
          <div className="games-turn-summary-title"><Bell size={20} /><strong>{waitingTitles.length === 1 ? `התור שלך ב${waitingTitles[0].title}` : `התור שלך ב־${waitingTitles.length} משחקים`}</strong></div>
          <p>בחרו את המשחק שמחכה לכם והמשיכו לשחק.</p>
          <div className="games-turn-links">
            {waitingTitles.map((game) => <button key={game.id} type="button" onClick={() => setSelected(game.id)}>{game.title}</button>)}
          </div>
        </section>
      )}
      {selected ? (
        <>
          <button
            className="button button-light mb-5"
            onClick={() => setSelected(null)}
          >
            <ArrowRight size={17} /> לכל המשחקים
          </button>
          {isWaiting(selected) && (
            <div className="game-board-turn-alert" role="status"><Bell size={18} /> התור שלך כאן — אפשר לשחק עכשיו</div>
          )}
          <Suspense fallback={<p role="status">טוענים את המשחק…</p>}>
            {selected === "tictactoe" && <TicTacToe />}
            {selected === "connectfour" && <ConnectFour />}
            {selected === "dotsandboxes" && <DotsAndBoxes />}
            {selected === "backgammon" && <Backgammon />}
          </Suspense>
        </>
      ) : (
        <div className="feature-grid">
          {orderedGames.map((game) => (
            <button
              className={`feature-card game-choice ${isWaiting(game.id) ? "game-needs-turn" : ""}`}
              key={game.id}
              onClick={() => setSelected(game.id)}
            >
              {isWaiting(game.id) && <span className="game-turn-alert"><Bell size={15} /> התור שלך במשחק הזה</span>}
              <span className={`feature-icon ${game.color}`}>
                <game.icon size={25} />
              </span>
              <h3>{game.title}</h3>
              <p>{game.text}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
