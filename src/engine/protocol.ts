// Wire protocol between the browser and the room Durable Object. Shared by both sides.
import type { Color, GameEvent, GameState, Mode } from "./rules";

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreads
export const ROOM_CODE_LENGTH = 6;
export const MAX_SEATS = 4;
export const EMOJIS = ["👍", "😂", "😮", "😡", "🔥", "🎉", "😭", "🙏"] as const;
export const MAX_NAME = 16;

/** Unbiased 6-character room code from random bytes (rejection sampling keeps letters equally likely). */
export function newRoomCode(randomBytes: (n: number) => Uint8Array = defaultBytes): string {
  const limit = 256 - (256 % ROOM_CODE_ALPHABET.length);
  let out = "";
  while (out.length < ROOM_CODE_LENGTH) {
    for (const b of randomBytes(16)) {
      if (b < limit && out.length < ROOM_CODE_LENGTH) out += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
    }
  }
  return out;
}

function defaultBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function normalizeRoomCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const code = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== ROOM_CODE_LENGTH) return null;
  return [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch)) ? code : null;
}

export function cleanName(name: unknown, fallback = "Player"): string {
  // eslint-disable-next-line no-control-regex
  const s = typeof name === "string" ? name.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, MAX_NAME) : "";
  return s || fallback;
}

export type ClientMsg =
  | { t: "hello"; name: string; clientSeed: string; token?: string; create?: boolean; rating?: number }
  | { t: "start"; quick?: boolean; ranked?: boolean }
  | { t: "addBot" }
  | { t: "removeBot"; seat: number }
  | { t: "roll" }
  | { t: "move"; token: number }
  | { t: "emoji"; emoji: string }
  | { t: "ping" };

export interface SeatView {
  name: string;
  color: Color | null;
  connected: boolean;
  /** Seat filled by a bot from the start. */
  bot: boolean;
  /** A bot is playing for a player who disconnected for 30s. */
  takeover: boolean;
  host: boolean;
  /** Rating change after a ranked game; null when unranked, or for bots and takeover seats. */
  ratingDelta: number | null;
}

export type RoomStatus = "lobby" | "playing" | "over";

export interface RoomView {
  code: string;
  status: RoomStatus;
  mode: Mode;
  ranked: boolean;
  seats: SeatView[];
  you: number | null;
  serverSeedHash: string;
  clientSeeds: string[];
  /** Revealed only when the game is over. */
  serverSeed: string | null;
  game: GameState | null;
  /** playerSeats[gamePlayerIndex] = seat index. */
  playerSeats: number[];
  events: GameEvent[];
  seq: number;
  /** Epoch ms when the current player's turn times out (null for bots or outside a game). */
  deadline: number | null;
  now: number;
}

export type ErrorCode = "not_found" | "exists" | "full" | "started" | "bad" | "not_allowed";

export type ServerMsg =
  | { t: "welcome"; seat: number; token: string; code: string }
  | { t: "state"; room: RoomView }
  | { t: "emoji"; seat: number; emoji: string }
  | { t: "error"; code: ErrorCode; message: string }
  | { t: "pong" };

/** Parse and validate an untrusted client message. Returns null for anything malformed. */
export function parseClientMsg(raw: unknown): ClientMsg | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  switch (o.t) {
    case "hello":
      return {
        t: "hello",
        name: cleanName(o.name, ""),
        clientSeed: typeof o.clientSeed === "string" ? o.clientSeed : "",
        token: typeof o.token === "string" ? o.token.slice(0, 64) : undefined,
        create: o.create === true,
        rating: Number.isInteger(o.rating) && (o.rating as number) >= 0 && (o.rating as number) <= 10_000 ? (o.rating as number) : undefined,
      };
    case "start":
      return { t: "start", quick: o.quick === true, ranked: o.ranked === true };
    case "addBot":
    case "roll":
    case "ping":
      return { t: o.t };
    case "removeBot":
      return Number.isInteger(o.seat) ? { t: "removeBot", seat: o.seat as number } : null;
    case "move":
      return Number.isInteger(o.token) ? { t: "move", token: o.token as number } : null;
    case "emoji":
      return typeof o.emoji === "string" && (EMOJIS as readonly string[]).includes(o.emoji)
        ? { t: "emoji", emoji: o.emoji }
        : null;
    default:
      return null;
  }
}
