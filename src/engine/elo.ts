// Multi-player ELO for ranked rooms. Pure: used by the Worker to compute deltas; the client stores ratings.
export const START_RATING = 1200;
export const K = 32;

/** Rating changes for players listed in finishing order (1st first). Every pair is a duel with weight K/(n-1); each transfer is rounded once so the total is exactly zero. */
export function eloDeltas(ratings: readonly number[]): number[] {
  const n = ratings.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const expected = 1 / (1 + 10 ** ((ratings[j] - ratings[i]) / 400));
      const move = Math.round((K / (n - 1)) * (1 - expected)); // i finished ahead of j
      out[i] += move;
      out[j] -= move;
    }
  }
  return out;
}

export function applyDeltas(rating: number, delta: number): number {
  return Math.max(0, Math.round(rating + delta));
}
