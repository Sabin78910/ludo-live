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
  | { t: "hello"; name: string; clientSeed: string; token?: string; create?: boolean }
  | { t: "start"; quick?: boolean }
  | { t: "addBot" }
  | { t: "removeBot"; seat: number }
  | { t: "roll" }
  | { t: "move"; token: number }
  | { t: "emoji"; emoji: string }
  | { t: "signal"; to: number; kind: SignalKind; data: string }
  | { t: "ping" };

export type SignalKind = "offer" | "answer" | "ice";
export const SIGNAL_KINDS: readonly SignalKind[] = ["offer", "answer", "ice"];
/** Largest SDP/ICE payload relayed; a voice-only SDP is a few KB at most. */
export const MAX_SIGNAL_DATA = 6000;
const MAX_MSG = 2000;
const MAX_SIGNAL_MSG = MAX_SIGNAL_DATA + 200;

export interface SeatView {
  name: string;
  color: Color | null;
  connected: boolean;
  /** Seat filled by a bot from the start. */
  bot: boolean;
  /** A bot is playing for a player who disconnected for 30s. */
  takeover: boolean;
  host: boolean;
}

export type RoomStatus = "lobby" | "playing" | "over";

export interface RoomView {
  code: string;
  status: RoomStatus;
  mode: Mode;
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
  | { t: "signal"; from: number; kind: SignalKind; data: string }
  | { t: "error"; code: ErrorCode; message: string }
  | { t: "pong" };

/** Parse and validate an untrusted client message. Returns null for anything malformed. */
export function parseClientMsg(raw: unknown): ClientMsg | null {
  if (typeof raw !== "string" || raw.length > MAX_SIGNAL_MSG) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  if (o.t !== "signal" && raw.length > MAX_MSG) return null;
  switch (o.t) {
    case "hello":
      return {
        t: "hello",
        name: cleanName(o.name, ""),
        clientSeed: typeof o.clientSeed === "string" ? o.clientSeed : "",
        token: typeof o.token === "string" ? o.token.slice(0, 64) : undefined,
        create: o.create === true,
      };
    case "start":
      return { t: "start", quick: o.quick === true };
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
    case "signal":
      return Number.isInteger(o.to) &&
        (SIGNAL_KINDS as readonly unknown[]).includes(o.kind) &&
        typeof o.data === "string" &&
        o.data.length > 0 &&
        o.data.length <= MAX_SIGNAL_DATA
        ? { t: "signal", to: o.to as number, kind: o.kind as SignalKind, data: o.data }
        : null;
    default:
      return null;
  }
}
