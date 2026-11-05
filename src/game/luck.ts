import type { RollRecord } from "../engine/rules";

export interface DiceLuck {
  player: number;
  rolls: number;
  /** How many times each face 1..6 came up (index 0 is face 1). */
  faces: number[];
  sixes: number;
  /** Sixes a fair die gives on average for this many rolls. */
  expectedSixes: number;
}

/** Per-player dice summary for the results screen, so players can see the dice treated everyone alike. */
export function diceLuck(rolls: readonly Pick<RollRecord, "player" | "value">[], players: readonly number[]): DiceLuck[] {
  return players.map((player) => {
    const faces = [0, 0, 0, 0, 0, 0];
    for (const r of rolls) if (r.player === player && r.value >= 1 && r.value <= 6) faces[r.value - 1] += 1;
    const total = faces.reduce((a, b) => a + b, 0);
    return { player, rolls: total, faces, sixes: faces[5], expectedSixes: Math.round((total / 6) * 10) / 10 };
  });
}
