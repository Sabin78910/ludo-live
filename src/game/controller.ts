import type { GameEvent, GameState } from "../engine/rules";

/** What the game screen needs, whether the game runs locally or on the server. */
export interface Controller {
  state: GameState | null;
  events: GameEvent[];
  seq: number;
  /** Token positions before the latest events, so they can be animated. */
  prevTokens: number[][] | null;
  /** Per game player: controlled by a human on this device. */
  local: boolean[];
  /** Per game player: played by a bot (including a takeover bot). */
  bots: boolean[];
  canAct: boolean;
  roll(): void;
  move(token: number): void;
  /** Local epoch ms when the current turn times out (online only). */
  deadline: number | null;
  fair: { serverSeedHash: string; clientSeeds: string[]; serverSeed: string | null };
  offline?: boolean[];
}
