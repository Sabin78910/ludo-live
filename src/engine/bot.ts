// Bot players. Heuristics score every legal move on capture, safety and progress.
// easy: mostly random; normal: heuristic with noise; hard: full heuristic including threat analysis.
import {
  BASE,
  isSafeIndex,
  legalMoves,
  target,
  specOf,
  trackIndex,
  type GameState,
} from "./rules";

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

/** Opponent tokens that could land on `cell` with a single roll of 1..6. */
export function threatsTo(state: GameState, player: number, cell: number): number {
  let n = 0;
  const spec = specOf(state);
  state.players.forEach((p, other) => {
    if (other === player) return;
    state.tokens[other].forEach((op) => {
      const at = trackIndex(p.color, op, spec);
      // Tokens in base can only enter onto their own start cell, which is safe, so they are no threat.
      if (at === null) return;
      const dist = (cell - at + spec.trackLen) % spec.trackLen;
      // The opponent must still be on the shared track when it reaches the cell.
      if (dist >= 1 && dist <= 6 && op + dist <= spec.lastTrack) n += 1;
    });
  });
  return n;
}

export interface MoveScore {
  token: number;
  score: number;
}

export function scoreMoves(state: GameState, hard = false): MoveScore[] {
  const me = state.current;
  const color = state.players[me].color;
  const dice = state.dice ?? 0;
  const spec = specOf(state);
  return legalMoves(state).map((token) => {
    const from = state.tokens[me][token];
    const to = target(from, dice, spec)!;
    let score = 0;
    const cell = trackIndex(color, to, spec);
    const safe = cell === null || isSafeIndex(cell, spec);
    // Captures
    if (cell !== null && !isSafeIndex(cell, spec)) {
      state.players.forEach((p, other) => {
        if (other === me) return;
        state.tokens[other].forEach((op) => {
          if (trackIndex(p.color, op, spec) === cell) score += 100 + (hard ? op * 1.2 : 0);
        });
      });
    }
    if (to === spec.finish) score += 70;
    if (from === BASE) score += 55;
    if (from <= spec.lastTrack && to > spec.lastTrack) score += 35; // reaches the safe home column
    if (safe && cell !== null) score += 20;
    if (!safe) score -= threatsTo(state, me, cell!) * (hard ? 32 : 18);
    if (hard && from >= 0 && from <= spec.lastTrack) {
      const fromCell = trackIndex(color, from, spec)!;
      if (!isSafeIndex(fromCell, spec)) score += threatsTo(state, me, fromCell) * 22; // escape danger
    }
    score += to * (hard ? 0.4 : 0.25);
    return { token, score };
  });
}

/** Pick a token to move. `rand` returns [0,1) so tests can seed it. */
export function chooseMove(state: GameState, difficulty: Difficulty, rand: () => number = Math.random): number {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error("No legal moves");
  if (moves.length === 1) return moves[0];
  if (difficulty === "easy" && rand() < 0.6) return moves[Math.floor(rand() * moves.length)];
  const scored = scoreMoves(state, difficulty === "hard");
  const noise = difficulty === "normal" ? 25 : difficulty === "easy" ? 60 : 0;
  let best = scored[0];
  let bestValue = -Infinity;
  for (const m of scored) {
    const v = m.score + (noise ? rand() * noise : 0);
    if (v > bestValue) {
      bestValue = v;
      best = m;
    }
  }
  return best.token;
}

/** Small seeded PRNG (mulberry32) for deterministic bots in tests and simulations. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
