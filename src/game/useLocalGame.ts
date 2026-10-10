// Offline games (vs bots, pass-and-play). Uses the same provably fair dealer as the server.
import { useCallback, useEffect, useRef, useState } from "react";
import { chooseMove, type Difficulty } from "../engine/bot";
import { FairDealer } from "../engine/fair";
import { applyMove, applyRoll, autoMove, createGame, type GameEvent, type GameState, type Player } from "../engine/rules";
import { animDuration } from "./anim";
import type { Controller } from "./controller";

export interface LocalSeat extends Player {
  bot: Difficulty | null;
}

export const BOT_THINK_MS = 450;

export function useLocalGame(seats: LocalSeat[], quick: boolean, clientSeed: string, reduced: boolean): Controller {
  const [snap, setSnap] = useState<{ state: GameState; events: GameEvent[]; seq: number; prev: number[][] }>(() => {
    const state = createGame(seats.map(({ color, name }) => ({ color, name })), { mode: quick ? "quick" : "classic" });
    return { state, events: [], seq: 0, prev: state.tokens };
  });
  const [dealer, setDealer] = useState<FairDealer | null>(null);
  const [busy, setBusy] = useState(false);
  const clientSeeds = useRef([clientSeed]).current;
  const snapRef = useRef(snap);
  snapRef.current = snap;

  useEffect(() => {
    let live = true;
    void FairDealer.create().then((d) => live && setDealer(d));
    return () => {
      live = false;
    };
  }, []);

  const commit = useCallback((state: GameState, events: GameEvent[]) => {
    const prev = snapRef.current.state.tokens;
    setSnap((s) => ({ state, events, seq: s.seq + 1, prev }));
    setBusy(true);
    const ms = animDuration(events, prev, reduced);
    setTimeout(() => setBusy(false), ms);
  }, [reduced]);

  const doRoll = useCallback(async () => {
    const s = snapRef.current.state;
    if (!dealer || s.phase !== "roll") return;
    const value = await dealer.roll(clientSeeds, s.rollCount);
    const step = applyRoll(s, value);
    const only = autoMove(step.state);
    if (step.state.phase === "move" && only !== null) {
      const m = applyMove(step.state, only);
      commit(m.state, [...step.events, ...m.events]);
    } else commit(step.state, step.events);
  }, [dealer, clientSeeds, commit]);

  const doMove = useCallback(
    (token: number) => {
      const s = snapRef.current.state;
      if (s.phase !== "move") return;
      try {
        const m = applyMove(s, token);
        commit(m.state, m.events);
      } catch {
        // Illegal tap: ignore.
      }
    },
    [commit],
  );

  // Bots act once the previous animation has finished.
  const { state } = snap;
  const botLevel = state.phase !== "over" ? seats[state.current]?.bot ?? null : null;
  useEffect(() => {
    if (busy || !dealer || botLevel === null) return;
    const id = setTimeout(() => {
      const s = snapRef.current.state;
      if (s.phase === "roll") void doRoll();
      else if (s.phase === "move") doMove(chooseMove(s, botLevel));
    }, reduced ? 120 : BOT_THINK_MS);
    return () => clearTimeout(id);
  }, [busy, dealer, botLevel, state, doRoll, doMove, reduced]);

  const isHumanTurn = botLevel === null && state.phase !== "over";
  return {
    state,
    events: snap.events,
    seq: snap.seq,
    prevTokens: snap.prev,
    local: seats.map((s) => s.bot === null),
    bots: seats.map((s) => s.bot !== null),
    canAct: isHumanTurn && !busy && dealer !== null,
    roll: () => {
      if (isHumanTurn && !busy) void doRoll();
    },
    move: (t) => {
      if (isHumanTurn && !busy) doMove(t);
    },
    deadline: null,
    fair: {
      serverSeedHash: dealer?.serverSeedHash ?? "",
      clientSeeds,
      serverSeed: state.phase === "over" && dealer ? dealer.reveal() : null,
    },
  };
}
