// WebSocket client for an online room with automatic reconnect + rejoin token.
import type { ClientMsg, ErrorCode, RoomView, ServerMsg } from "../engine/protocol";

export type ConnStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface RoomHandlers {
  onState(room: RoomView, receivedAt: number): void;
  onWelcome?(seat: number, token: string): void;
  onEmoji?(seat: number, emoji: string): void;
  onChat?(playerId: number, phraseId: string): void;
  onError?(code: ErrorCode, message: string): void;
  onStatus?(status: ConnStatus): void;
}

export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

const FATAL: ErrorCode[] = ["not_found", "full", "started", "exists"];
// Per-tab storage: survives reloads and reconnects, and two tabs in one browser stay two players.
const tokenKey = (code: string) => `ludo-live.room.${code}`;

export function savedToken(code: string, storage?: Pick<Storage, "getItem">): string | undefined {
  try {
    return (storage ?? sessionStorage).getItem(tokenKey(code)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveToken(code: string, token: string, storage?: Pick<Storage, "setItem">): void {
  try {
    (storage ?? sessionStorage).setItem(tokenKey(code), token);
  } catch {
    // Without storage the player can still play; rejoin after reload won't work.
  }
}

/** Backoff for reconnect attempt n (0-based): 0.5s, 1s, 2s, 4s, then 8s max. */
export function backoff(attempt: number): number {
  return Math.min(8000, 500 * 2 ** attempt);
}

export class RoomClient {
  private ws: SocketLike | null = null;
  private attempts = 0;
  private stopped = false;
  private token: string | undefined;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pinger: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly url: string,
    private readonly code: string,
    private readonly hello: { name: string; clientSeed: string; create: boolean },
    private readonly handlers: RoomHandlers,
    private readonly makeSocket: (url: string) => SocketLike = (u) => new WebSocket(u) as unknown as SocketLike,
  ) {
    this.token = savedToken(code);
  }

  connect(): void {
    this.stopped = false;
    this.handlers.onStatus?.(this.attempts === 0 ? "connecting" : "reconnecting");
    const ws = this.makeSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      this.handlers.onStatus?.("open");
      // Only ask to create the room if we have never been in it.
      this.send({ t: "hello", name: this.hello.name, clientSeed: this.hello.clientSeed, token: this.token, create: this.hello.create && !this.token });
      this.pinger = setInterval(() => this.send({ t: "ping" }), 10_000);
    };
    ws.onmessage = (ev) => this.receive(ev.data);
    ws.onclose = () => this.closed(ws);
    ws.onerror = () => undefined;
  }

  private receive(data: unknown): void {
    if (typeof data !== "string") return;
    let msg: ServerMsg;
    try {
      msg = JSON.parse(data) as ServerMsg;
    } catch {
      return;
    }
    switch (msg.t) {
      case "welcome":
        this.token = msg.token;
        saveToken(this.code, msg.token);
        this.handlers.onWelcome?.(msg.seat, msg.token);
        break;
      case "state":
        this.handlers.onState(msg.room, Date.now());
        break;
      case "emoji":
        this.handlers.onEmoji?.(msg.seat, msg.emoji);
        break;
      case "chat":
        this.handlers.onChat?.(msg.playerId, msg.phraseId);
        break;
      case "error":
        this.handlers.onError?.(msg.code, msg.message);
        if (FATAL.includes(msg.code)) this.stop();
        break;
    }
  }

  private closed(ws: SocketLike): void {
    if (this.pinger) clearInterval(this.pinger);
    this.pinger = null;
    if (ws !== this.ws) return;
    if (this.stopped) {
      this.handlers.onStatus?.("closed");
      return;
    }
    this.handlers.onStatus?.("reconnecting");
    this.timer = setTimeout(() => this.connect(), backoff(this.attempts++));
  }

  send(msg: ClientMsg): boolean {
    if (!this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.pinger) clearInterval(this.pinger);
    this.ws?.close(1000, "bye");
  }
}
