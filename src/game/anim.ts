// Turns engine events into animation frames: one frame per cell hopped, then captures fly home.
import { BASE, type GameEvent } from "../engine/rules";

export const ROLL_MS = 600;
export const STEP_MS = 160;
export const CAPTURE_MS = 420;

export type FrameFx =
  | { kind: "hop"; player: number; token: number; last: boolean }
  | { kind: "enter"; player: number; token: number }
  | { kind: "capture"; player: number; victim: number; token: number; cell: number }
  | { kind: "home"; player: number; token: number };

export interface Frame {
  tokens: number[][];
  fx: FrameFx[];
  ms: number;
}

/** Frames that take `start` (positions before the events) to the positions after them. */
export function buildFrames(start: number[][], events: GameEvent[]): Frame[] {
  let cur = start.map((t) => [...t]);
  const frames: Frame[] = [];
  for (const e of events) {
    if (e.type === "move") {
      if (e.from === BASE) {
        cur = cur.map((t) => [...t]);
        cur[e.player][e.token] = 0;
        frames.push({ tokens: cur, fx: [{ kind: "enter", player: e.player, token: e.token }], ms: STEP_MS * 2 });
      } else {
        e.path.forEach((p, i) => {
          cur = cur.map((t) => [...t]);
          cur[e.player][e.token] = p;
          frames.push({ tokens: cur, fx: [{ kind: "hop", player: e.player, token: e.token, last: i === e.path.length - 1 }], ms: STEP_MS });
        });
      }
    } else if (e.type === "capture") {
      cur = cur.map((t) => [...t]);
      cur[e.victim][e.token] = BASE;
      frames.push({ tokens: cur, fx: [{ kind: "capture", player: e.player, victim: e.victim, token: e.token, cell: e.cell }], ms: CAPTURE_MS });
    } else if (e.type === "home") {
      const last = frames.at(-1);
      if (last) last.fx.push({ kind: "home", player: e.player, token: e.token });
    }
  }
  return frames;
}

/** Total animation time for a batch of events, used to pace bots so they never act mid-animation. */
export function animDuration(events: GameEvent[], start: number[][] | null = null, reduced = false): number {
  if (reduced) return events.some((e) => e.type === "roll") ? 150 : 0;
  const roll = events.some((e) => e.type === "roll") ? ROLL_MS : 0;
  const frames = start ? buildFrames(start, events) : buildFrames(emptyFor(events), events);
  return roll + frames.reduce((s, f) => s + f.ms, 0);
}

function emptyFor(events: GameEvent[]): number[][] {
  const players = Math.max(0, ...events.map((e) => ("player" in e ? e.player : 0)), ...events.map((e) => (e.type === "capture" ? e.victim : 0))) + 1;
  return Array.from({ length: players }, () => [BASE, BASE, BASE, BASE]);
}

/** The status message key for the latest events. */
export function eventToast(events: GameEvent[]): "rolledSix" | "captured" | "threeSixes" | "noMoves" | null {
  if (events.some((e) => e.type === "forfeit")) return "threeSixes";
  if (events.some((e) => e.type === "capture")) return "captured";
  if (events.some((e) => e.type === "noMoves")) return "noMoves";
  if (events.some((e) => e.type === "bonus" && e.reason === "six")) return "rolledSix";
  return null;
}
