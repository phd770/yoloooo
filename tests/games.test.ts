import { describe, expect, it } from "vitest";
import { advanceTicTacToe } from "../src/components/Games";
import {
  checkWinner,
  createEmptyBoard,
  deserializeBoard,
  getAvailableRow,
  isBoardFull,
  serializeBoard,
} from "../src/components/ConnectFour";
import { sameData, withMoveTimeout } from "../src/lib/gameSync";
import { getGameTurn, isUsersTurn } from "../src/lib/gameTurnNotifications";

const ttt = (over: any = {}) => ({
  board: Array(9).fill(null),
  turn: "boaz",
  status: "playing",
  winner: null,
  winningLine: [],
  updatedAt: 0,
  scores: { boaz: 0, mishel: 0 },
  ...over,
});

describe("advanceTicTacToe", () => {
  it("plays a move and passes the turn", () => {
    const next = advanceTicTacToe(ttt() as any, 4, "boaz", "mishel");
    expect(next.board[4]).toBe("boaz");
    expect(next.turn).toBe("mishel");
  });
  it("rejects out-of-turn, occupied, out-of-range and finished moves", () => {
    expect(() => advanceTicTacToe(ttt() as any, 0, "mishel", "boaz")).toThrow();
    const occupied = ttt({ board: ["mishel", ...Array(8).fill(null)] });
    expect(() => advanceTicTacToe(occupied as any, 0, "boaz", "mishel")).toThrow();
    expect(() => advanceTicTacToe(ttt() as any, 9, "boaz", "mishel")).toThrow();
    expect(() => advanceTicTacToe(ttt({ status: "won" }) as any, 0, "boaz", "mishel")).toThrow();
  });
  it("detects a win and a draw", () => {
    const almost = ttt({ board: ["boaz", "boaz", null, ...Array(6).fill(null)] });
    const won = advanceTicTacToe(almost as any, 2, "boaz", "mishel");
    expect(won.status).toBe("won");
    expect(won.winner).toBe("boaz");
    expect(won.scores.boaz).toBe(1);
    const x = "boaz", o = "mishel";
    const drawBoard = ttt({ board: [x, o, x, x, o, o, o, x, null] });
    expect(advanceTicTacToe(drawBoard as any, 8, "boaz", "mishel").status).toBe("draw");
  });
});

describe("connect four logic", () => {
  it("drops to the lowest free row and reports full columns", () => {
    const board = createEmptyBoard();
    expect(getAvailableRow(board, 3)).toBe(5);
    board[5][3] = "R";
    expect(getAvailableRow(board, 3)).toBe(4);
    for (let r = 0; r < 6; r++) board[r][3] = "Y";
    expect(getAvailableRow(board, 3)).toBeNull();
  });
  it("finds horizontal, vertical and diagonal wins", () => {
    const h = createEmptyBoard();
    for (let c = 0; c < 4; c++) h[5][c] = "R";
    expect(checkWinner(h, "R")).toHaveLength(4);
    expect(checkWinner(h, "Y")).toBeNull();
    const v = createEmptyBoard();
    for (let r = 2; r < 6; r++) v[r][0] = "Y";
    expect(checkWinner(v, "Y")).toHaveLength(4);
    const d = createEmptyBoard();
    for (let i = 0; i < 4; i++) d[5 - i][i] = "R";
    expect(checkWinner(d, "R")).toHaveLength(4);
  });
  it("detects a full board and round-trips serialization", () => {
    const board = createEmptyBoard();
    expect(isBoardFull(board)).toBe(false);
    board.forEach((row) => row.fill("R"));
    expect(isBoardFull(board)).toBe(true);
    expect(deserializeBoard(serializeBoard(board))).toEqual(board);
    expect(deserializeBoard(null)).toEqual(createEmptyBoard());
  });
});

describe("gameSync", () => {
  it("sameData ignores identity but not content", () => {
    expect(sameData({ a: [1] }, { a: [1] })).toBe(true);
    expect(sameData({ a: [1] }, { a: [2] })).toBe(false);
    expect(sameData(null, { a: 1 })).toBe(false);
  });
  it("withMoveTimeout resolves fast requests and rejects slow ones", async () => {
    await expect(withMoveTimeout(Promise.resolve(1), 50)).resolves.toBe(1);
    await expect(withMoveTimeout(new Promise(() => {}), 10)).rejects.toThrow();
  });
});

describe("game turn notifications", () => {
  it("maps connect4 colors to the player id", () => {
    const turn = getGameTurn("connect4", {
      status: "active",
      currentTurn: "Y",
      players: { R: "boaz", Y: "mishel" },
    });
    expect(isUsersTurn(turn, "mishel")).toBe(true);
    expect(isUsersTurn(turn, "boaz")).toBe(false);
  });
  it("is nobody's turn once the game ended", () => {
    const turn = getGameTurn("tictactoe", { status: "won", turn: "boaz" });
    expect(isUsersTurn(turn, "boaz")).toBe(false);
  });
});
