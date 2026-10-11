import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientMsg, ErrorCode, RoomView } from "../engine/protocol";
import { animDuration } from "../game/anim";
import type { Controller } from "../game/controller";
import { RoomClient, type ConnStatus } from "./client";

export interface Reaction {
  id: number;
  seat: number;
  emoji: string;
}

export interface OnlineRoom {
  room: RoomView | null;
  status: ConnStatus;
  error: { code: ErrorCode; message: string } | null;
  reactions: Reaction[];
  send(msg: ClientMsg): void;
  controller: Controller | null;
}

export function useOnlineRoom(url: string, code: string, name: string, clientSeed: string, create: boolean, reduced: boolean, rating?: number): OnlineRoom {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [skew, setSkew] = useState(0);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [error, setError] = useState<OnlineRoom["error"]>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [busyUntil, setBusyUntil] = useState(0);
  const [, force] = useState(0);
  const prevRef = useRef<{ seq: number; tokens: number[][] | null }>({ seq: -1, tokens: null });
  const [prevTokens, setPrevTokens] = useState<number[][] | null>(null);
  const clientRef = useRef<RoomClient | null>(null);

  useEffect(() => {
    let rid = 0;
    const c = new RoomClient(url, code, { name, clientSeed, create, rating }, {
      onState(view, at) {
        const prev = prevRef.current;
        // Animate only consecutive updates; after a reconnect the board snaps into place.
        const from = view.seq === prev.seq + 1 ? prev.tokens : null;
        prevRef.current = { seq: view.seq, tokens: view.game?.tokens ?? null };
        setPrevTokens(from);
        if (view.seq !== prev.seq && from) setBusyUntil(at + animDuration(view.events, from, reduced));
        setSkew(at - view.now);
        setRoom(view);
      },
      onEmoji(seat, emoji) {
        const id = ++rid;
        setReactions((r) => [...r.slice(-5), { id, seat, emoji }]);
        setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2400);
      },
      onError(code, message) {
        setError({ code, message });
      },
      onStatus: setStatus,
    });
    clientRef.current = c;
    c.connect();
    return () => c.stop();
  }, [url, code, name, clientSeed, create, reduced, rating]);

  // Re-render when the animation lock ends.
  useEffect(() => {
    const ms = busyUntil - Date.now();
    if (ms <= 0) return;
    const id = setTimeout(() => force((n) => n + 1), ms + 10);
    return () => clearTimeout(id);
  }, [busyUntil]);

  const send = (msg: ClientMsg) => {
    setError(null);
    clientRef.current?.send(msg);
  };

  const controller = useMemo<Controller | null>(() => {
    if (!room?.game) return null;
    const g = room.game;
    const mine = (i: number) => room.playerSeats[i] === room.you;
    const seatOf = (i: number) => room.seats[room.playerSeats[i]];
    const myTurn = g.phase !== "over" && mine(g.current) && !seatOf(g.current)?.takeover;
    return {
      state: g,
      events: room.events,
      seq: room.seq,
      prevTokens,
      local: g.players.map((_, i) => mine(i)),
      bots: g.players.map((_, i) => !!(seatOf(i)?.bot || seatOf(i)?.takeover)),
      offline: g.players.map((_, i) => !seatOf(i)?.connected),
      canAct: myTurn && status === "open",
      roll: () => clientRef.current?.send({ t: "roll" }),
      move: (token) => clientRef.current?.send({ t: "move", token }),
      deadline: room.deadline === null ? null : room.deadline + skew,
      fair: { serverSeedHash: room.serverSeedHash, clientSeeds: room.clientSeeds, serverSeed: room.serverSeed },
    };
  }, [room, prevTokens, status, skew]);

  // The animation lock is time based, so it is applied on every render (force() re-renders when it ends).
  const ctl = controller && { ...controller, canAct: controller.canAct && Date.now() >= busyUntil };
  return { room, status, error, reactions, send, controller: ctl };
}
