type GameState = Record<string, unknown>;

export type GameTurn = {
  gameId: string;
  title: string;
  isActive: boolean;
  playerId: string | null;
};

export function getGameTurn(gameId: string, state: GameState): GameTurn {
  if (gameId === "connect4") {
    const players = state.players as Record<string, string> | undefined;
    const color = state.currentTurn;
    const isActive = state.status === "active";
    return {
      gameId,
      title: "ארבע בשורה",
      isActive,
      playerId: isActive && typeof color === "string" ? players?.[color] || null : null,
    };
  }

  const isActive = state.status === "playing" || state.status === "active";
  return {
    gameId,
    title:
      gameId === "tictactoe"
        ? "איקס עיגול"
        : gameId === "dotsandboxes"
          ? "קווים וריבועים"
          : "שש בש",
    isActive,
    playerId: isActive && typeof state.turn === "string" ? state.turn : null,
  };
}

export function isUsersTurn(turn: GameTurn, currentUserId: string): boolean {
  return turn.isActive && turn.playerId === currentUserId;
}
