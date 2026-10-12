// Authoritative room logic, independent of the Durable Object runtime so it can be unit tested.
// The Durable Object (index.ts) only stores RoomData, forwards messages and schedules alarms.
import { chooseMove } from "../../src/engine/bot";
import { cleanClientSeed, deriveRoll, randomHex, sha256Hex } from "../../src/engine/fair";
import { MAX_SEATS, cleanName, type ErrorCode, type RoomStatus, type RoomView } from "../../src/engine/protocol";
import {
  animationSteps,
  applyMove,
  applyRoll,
  autoMove,
  createGame,
  legalMoves,
  seatColors,
  type GameEvent,
  type GameState,
  type Mode,
} from "../../src/engine/rules";
import { weekTwist } from "../../src/engine/tournament";

export const TURN_MS = 20_000;
export const TAKEOVER_MS = 30_000;
export const BOT_DELAY_MS = 1_000;
export const STEP_MS = 160;
export const EMOJI_GAP_MS = 1_200;
/** Rooms with nobody connected are forgotten after this long. */
export const IDLE_EXPIRY_MS = 6 * 60 * 60 * 1000;

export interface SeatState {
  token: string;
  name: string;
  clientSeed: string;
  connected: boolean;
  disconnectedAt: number | null;
  bot: boolean;
  takeover: boolean;
  lastEmojiAt: number;
  /** Stable anonymous id from the client, used only for the weekly leaderboard. */
  player?: string;
}

export interface RoomData {
  code: string;
  createdAt: number;
  host: number;
  seats: SeatState[];
  serverSeed: string;
  serverSeedHash: string;
  status: RoomStatus;
  mode: Mode;
  clientSeeds: string[];
  game: GameState | null;
  playerSeats: number[];
  events: GameEvent[];
  seq: number;
  /** When the current turn is played automatically (bot delay, or the human turn timer). */
  actAt: number | null;
  lastActivity: number;
  /** ISO week key if this table plays the weekly tournament twist. */
  tournament?: string | null;
  /** The tournament result was already sent to the leaderboard. */
  reported?: boolean;
}

export type JoinResult = { ok: true; seat: number; token: string; rejoined: boolean } | { ok: false; code: ErrorCode; message: string };
export type ActionResult = { ok: true } | { ok: false; code: ErrorCode; message: string };

const fail = (code: ErrorCode, message: string) => ({ ok: false as const, code, message });

export class RoomCore {
  constructor(public data: RoomData) {}

  static async create(code: string, now: number, serverSeed: string = randomHex(32), tournament: string | null = null): Promise<RoomCore> {
    return new RoomCore({
      code,
      createdAt: now,
      host: 0,
      seats: [],
      serverSeed,
      // The commitment exists before anyone joins, so client seeds can't be chosen to suit the server.
      serverSeedHash: await sha256Hex(serverSeed),
      status: "lobby",
      mode: "classic",
      clientSeeds: [],
      game: null,
      playerSeats: [],
      events: [],
      seq: 0,
      actAt: null,
      lastActivity: now,
      tournament,
      reported: false,
    });
  }

  seatOfToken(token: string | undefined): number {
    return token ? this.data.seats.findIndex((s) => s.token === token) : -1;
  }

  join(msg: { name: string; clientSeed: string; token?: string; player?: string }, now: number, newToken: () => string = () => randomHex(16)): JoinResult {
    const d = this.data;
    d.lastActivity = now;
    const existing = this.seatOfToken(msg.token);
    if (existing >= 0) {
      const seat = d.seats[existing];
      seat.connected = true;
      seat.disconnectedAt = null;
      seat.takeover = false; // the player is back: the bot hands control back
      if (d.status === "playing" && this.currentSeat() === existing) this.schedule(now);
      return { ok: true, seat: existing, token: seat.token, rejoined: true };
    }
    if (d.status !== "lobby") return fail("started", "This game has already started");
    if (d.seats.length >= MAX_SEATS) return fail("full", "This room is full");
    const token = newToken();
    d.seats.push({
      token,
      name: cleanName(msg.name, `Player ${d.seats.length + 1}`),
      clientSeed: cleanClientSeed(msg.clientSeed),
      connected: true,
      disconnectedAt: null,
      bot: false,
      takeover: false,
      lastEmojiAt: 0,
      player: msg.player,
    });
    if (d.seats.length === 1 || !d.seats[d.host]?.connected) d.host = d.seats.length - 1;
    return { ok: true, seat: d.seats.length - 1, token, rejoined: false };
  }

  disconnect(seat: number, now: number): void {
    const s = this.data.seats[seat];
    if (!s || s.bot) return;
    s.connected = false;
    s.disconnectedAt = now;
    if (this.data.status === "lobby" && this.data.host === seat) {
      const next = this.data.seats.findIndex((x) => x.connected && !x.bot);
      if (next >= 0) this.data.host = next;
    }
  }

  addBot(seat: number, now: number): ActionResult {
    const d = this.data;
    if (seat !== d.host) return fail("not_allowed", "Only the host can add bots");
    if (d.status !== "lobby") return fail("started", "The game has started");
    if (d.seats.length >= MAX_SEATS) return fail("full", "The room is full");
    const n = d.seats.filter((s) => s.bot).length + 1;
    d.seats.push({
      token: randomHex(16),
      name: `Bot ${n}`,
      clientSeed: randomHex(8),
      connected: true,
      disconnectedAt: null,
      bot: true,
      takeover: false,
      lastEmojiAt: 0,
    });
    d.lastActivity = now;
    return { ok: true };
  }

  removeBot(seat: number, target: number): ActionResult {
    const d = this.data;
    if (seat !== d.host) return fail("not_allowed", "Only the host can remove bots");
    if (d.status !== "lobby" || !d.seats[target]?.bot) return fail("bad", "No bot in that seat");
    d.seats.splice(target, 1);
    if (d.host > target) d.host -= 1;
    return { ok: true };
  }

  start(seat: number, quick: boolean, now: number): ActionResult {
    const d = this.data;
    if (seat !== d.host) return fail("not_allowed", "Only the host can start");
    if (d.status !== "lobby") return fail("started", "The game has started");
    // Players who left the lobby give up their seat.
    const hostToken = d.seats[d.host].token;
    d.seats = d.seats.filter((s) => s.connected || s.bot);
    d.host = Math.max(0, d.seats.findIndex((s) => s.token === hostToken));
    if (d.seats.length < 2) return fail("bad", "Need at least 2 players (add a bot)");
    const twist = d.tournament ? weekTwist(d.tournament) : null;
    if (twist?.players && d.seats.length !== twist.players) return fail("bad", `This week's tables seat exactly ${twist.players} players`);
    const colors = seatColors(d.seats.length);
    d.mode = quick || twist?.quick ? "quick" : "classic";
    d.clientSeeds = d.seats.map((s) => s.clientSeed); // locked from here on
    d.playerSeats = d.seats.map((_, i) => i);
    d.game = createGame(
      d.seats.map((s, i) => ({ color: colors[i], name: s.name })),
      { mode: d.mode },
    );
    d.status = "playing";
    this.emit([{ type: "turn", player: 0 }], now);
    return { ok: true };
  }

  /** The human winner of a finished tournament table, until it has been reported. */
  pendingWin(): { week: string; player: string; name: string } | null {
    const d = this.data;
    if (!d.tournament || d.reported || d.status !== "over" || !d.game) return null;
    const seat = d.seats[d.playerSeats[d.game.finished[0]]];
    return seat && !seat.bot && seat.player ? { week: d.tournament, player: seat.player, name: seat.name } : null;
  }

  markReported(): void {
    this.data.reported = true;
  }

  currentSeat(): number | null {
    const g = this.data.game;
    return g && g.phase !== "over" ? this.data.playerSeats[g.current] : null;
  }

  isBotTurn(): boolean {
    const seat = this.currentSeat();
    if (seat === null) return false;
    const s = this.data.seats[seat];
    return s.bot || s.takeover;
  }

  async roll(seat: number, now: number): Promise<ActionResult> {
    const g = this.data.game;
    if (!g || this.data.status !== "playing") return fail("bad", "No game in progress");
    if (this.currentSeat() !== seat) return fail("not_allowed", "Not your turn");
    if (g.phase !== "roll") return fail("bad", "Move a token first");
    await this.doRoll(now);
    return { ok: true };
  }

  move(seat: number, token: number, now: number): ActionResult {
    const g = this.data.game;
    if (!g || this.data.status !== "playing") return fail("bad", "No game in progress");
    if (this.currentSeat() !== seat) return fail("not_allowed", "Not your turn");
    if (g.phase !== "move" || !legalMoves(g).includes(token)) return fail("bad", "That token cannot move");
    this.doMove(token, [], now);
    return { ok: true };
  }

  emoji(seat: number, now: number): boolean {
    const s = this.data.seats[seat];
    if (!s || now - s.lastEmojiAt < EMOJI_GAP_MS) return false;
    s.lastEmojiAt = now;
    return true;
  }

  private async doRoll(now: number): Promise<void> {
    const g = this.data.game!;
    const value = await deriveRoll(this.data.serverSeed, this.data.clientSeeds, g.rollCount);
    const step = applyRoll(g, value);
    this.data.game = step.state;
    const only = autoMove(step.state);
    if (step.state.phase === "move" && only !== null) {
      this.doMove(only, step.events, now); // no real choice: move straight away, like Ludo King
    } else {
      this.emit(step.events, now);
    }
  }

  private doMove(token: number, prior: GameEvent[], now: number): void {
    const step = applyMove(this.data.game!, token);
    this.data.game = step.state;
    this.emit([...prior, ...step.events], now);
  }

  private emit(events: GameEvent[], now: number): void {
    const d = this.data;
    d.events = events;
    d.seq += 1;
    d.lastActivity = now;
    if (d.game?.phase === "over") {
      d.status = "over";
      d.actAt = null;
      return;
    }
    this.schedule(now + animationSteps(events) * STEP_MS);
  }

  private schedule(from: number): void {
    this.data.actAt = from + (this.isBotTurn() ? BOT_DELAY_MS : TURN_MS);
  }

  /** Run timers: bot takeover after 30s offline, bot turns and expired turn timers. Returns true if anything changed. */
  async tick(now: number): Promise<boolean> {
    const d = this.data;
    let changed = false;
    if (d.status === "playing") {
      for (const s of d.seats) {
        if (!s.connected && !s.bot && !s.takeover && s.disconnectedAt !== null && now - s.disconnectedAt >= TAKEOVER_MS) {
          s.takeover = true;
          changed = true;
          if (d.seats[this.currentSeat() ?? -1] === s) this.schedule(now);
        }
      }
    }
    let guard = 0;
    while (d.status === "playing" && d.actAt !== null && now >= d.actAt && guard++ < 8) {
      await this.autoAct(now);
      changed = true;
    }
    return changed;
  }

  /** Play the current turn automatically (bot seat, takeover, or a human whose timer ran out). */
  private async autoAct(now: number): Promise<void> {
    const g = this.data.game!;
    if (g.phase === "roll") {
      await this.doRoll(now);
    } else {
      const seat = this.data.seats[this.currentSeat()!];
      this.doMove(chooseMove(g, seat.bot ? "hard" : "normal"), [], now);
    }
  }

  /** Next time the Durable Object alarm should fire, or null if nothing is pending. */
  nextAlarm(): number | null {
    const d = this.data;
    const times: number[] = [];
    if (d.actAt !== null && d.status === "playing") times.push(d.actAt);
    if (d.status === "playing") {
      for (const s of d.seats) {
        if (!s.connected && !s.bot && !s.takeover && s.disconnectedAt !== null) times.push(s.disconnectedAt + TAKEOVER_MS);
      }
    }
    if (d.seats.every((s) => !s.connected || s.bot)) times.push(d.lastActivity + IDLE_EXPIRY_MS);
    return times.length ? Math.min(...times) : null;
  }

  isExpired(now: number): boolean {
    const d = this.data;
    return d.seats.every((s) => !s.connected || s.bot) && now - d.lastActivity >= IDLE_EXPIRY_MS;
  }

  view(seat: number | null, now: number): RoomView {
    const d = this.data;
    const colors = d.game ? d.game.players.map((p) => p.color) : [];
    return {
      code: d.code,
      status: d.status,
      mode: d.mode,
      seats: d.seats.map((s, i) => ({
        name: s.name,
        color: colors[d.playerSeats.indexOf(i)] ?? null,
        connected: s.connected,
        bot: s.bot,
        takeover: s.takeover,
        host: i === d.host,
      })),
      you: seat,
      serverSeedHash: d.serverSeedHash,
      clientSeeds: d.status === "lobby" ? d.seats.map((s) => s.clientSeed) : d.clientSeeds,
      serverSeed: d.status === "over" ? d.serverSeed : null,
      game: d.game,
      playerSeats: d.playerSeats,
      events: d.events,
      seq: d.seq,
      deadline: d.status === "playing" && !this.isBotTurn() ? d.actAt : null,
      now,
      tournament: d.tournament ?? null,
    };
  }
}
