// Cloudflare Worker entry: routes wss://<worker>/room/<CODE> to one Durable Object per room.
// The Durable Object uses the WebSocket Hibernation API, keeps RoomData in storage and drives timers with alarms.
import { normalizeRoomCode, parseClientMsg, type ServerMsg } from "../../src/engine/protocol";
import { RoomCore, type RoomData } from "./room";

export interface Env {
  ROOMS: DurableObjectNamespace;
}

interface Attachment {
  code: string;
  token: string | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/health") return json({ ok: true, app: "ludo-live" });
    const match = url.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
    const code = normalizeRoomCode(match?.[1]);
    if (!code) return json({ error: "not found" }, 404);
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "expected a WebSocket" }, 426);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    return stub.fetch(req);
  },
} satisfies ExportedHandler<Env>;

export class LudoRoom implements DurableObject {
  private room: RoomCore | null = null;

  constructor(private readonly state: DurableObjectState) {}

  private async load(): Promise<RoomCore | null> {
    if (!this.room) {
      const data = await this.state.storage.get<RoomData>("room");
      if (data) this.room = new RoomCore(data);
    }
    return this.room;
  }

  async fetch(req: Request): Promise<Response> {
    const code = normalizeRoomCode(new URL(req.url).pathname.slice(1).split("/").pop());
    if (!code) return new Response("bad room", { status: 400 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ code, token: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const msg = parseClientMsg(typeof message === "string" ? message : null);
    if (!msg) return send(ws, { t: "error", code: "bad", message: "Bad message" });
    const att = ws.deserializeAttachment() as Attachment;
    const now = Date.now();
    let room = await this.load();
    // Self-heal: any message (including the 10s keep-alive ping) also runs overdue timers,
    // so a late or lost alarm can never freeze a game.
    if (room && room.data.status === "playing" && (await room.tick(now))) await this.commit(room, now);
    if (msg.t === "ping") return send(ws, { t: "pong" });

    if (msg.t === "hello") {
      if (!room) {
        if (!msg.create) {
          send(ws, { t: "error", code: "not_found", message: "Room not found. Check the code." });
          return ws.close(4004, "not found");
        }
        room = this.room = await RoomCore.create(att.code, now);
      } else if (msg.create && room.seatOfToken(msg.token) < 0 && room.data.seats.length > 0) {
        send(ws, { t: "error", code: "exists", message: "Room code in use" });
        return ws.close(4009, "exists");
      }
      const res = room.join(msg, now);
      if (!res.ok) {
        send(ws, { t: "error", code: res.code, message: res.message });
        return ws.close(4003, res.code);
      }
      // A newer connection replaces an older one for the same player (e.g. after a network switch).
      for (const other of this.state.getWebSockets()) {
        if (other !== ws && (other.deserializeAttachment() as Attachment).token === res.token) {
          other.serializeAttachment({ code: att.code, token: null } satisfies Attachment);
          other.close(4000, "replaced");
        }
      }
      ws.serializeAttachment({ code: att.code, token: res.token } satisfies Attachment);
      send(ws, { t: "welcome", seat: res.seat, token: res.token, code: room.data.code });
      return this.commit(room, now);
    }

    const seat = room ? room.seatOfToken(att.token ?? undefined) : -1;
    if (!room || seat < 0) return send(ws, { t: "error", code: "bad", message: "Say hello first" });
    let result: { ok: boolean; code?: string; message?: string } = { ok: true };
    switch (msg.t) {
      case "start":
        result = room.start(seat, msg.quick === true, now);
        break;
      case "board":
        result = room.setBoard(seat, msg.board);
        break;
      case "addBot":
        result = room.addBot(seat, now);
        break;
      case "removeBot":
        result = room.removeBot(seat, msg.seat);
        break;
      case "roll":
        result = await room.roll(seat, now);
        break;
      case "move":
        result = room.move(seat, msg.token, now);
        break;
      case "emoji":
        if (room.emoji(seat, now)) this.broadcastRaw({ t: "emoji", seat, emoji: msg.emoji });
        return;
    }
    if (!result.ok) send(ws, { t: "error", code: (result.code ?? "bad") as "bad", message: result.message ?? "Not allowed" });
    else await this.commit(room, now);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.dropSocket(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.dropSocket(ws);
  }

  private async dropSocket(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    const room = await this.load();
    if (!room || !att?.token) return;
    const stillOpen = this.state
      .getWebSockets()
      .some((o) => o !== ws && (o.deserializeAttachment() as Attachment).token === att.token);
    if (stillOpen) return;
    const seat = room.seatOfToken(att.token);
    if (seat >= 0) {
      room.disconnect(seat, Date.now());
      await this.commit(room, Date.now());
    }
  }

  async alarm(): Promise<void> {
    const room = await this.load();
    if (!room) return;
    const now = Date.now();
    if (room.isExpired(now)) {
      await this.state.storage.deleteAll();
      this.room = null;
      return;
    }
    await room.tick(now);
    await this.commit(room, now);
  }

  private async commit(room: RoomCore, now: number): Promise<void> {
    await this.state.storage.put("room", room.data);
    const next = room.nextAlarm();
    if (next !== null) await this.state.storage.setAlarm(Math.max(next, now + 50));
    else await this.state.storage.deleteAlarm();
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment;
      if (!att.token) continue;
      const seat = room.seatOfToken(att.token);
      send(ws, { t: "state", room: room.view(seat >= 0 ? seat : null, now) });
    }
  }

  private broadcastRaw(msg: ServerMsg): void {
    for (const ws of this.state.getWebSockets()) {
      if ((ws.deserializeAttachment() as Attachment).token) send(ws, msg);
    }
  }
}

function send(ws: WebSocket, msg: ServerMsg): void {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // The socket closed in the meantime; the close handler cleans up.
  }
}
