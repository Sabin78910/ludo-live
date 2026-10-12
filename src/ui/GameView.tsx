import { useEffect, useMemo, useRef, useState } from "react";
import { tokenPosition, TRACK } from "../engine/board";
import { EMOJIS } from "../engine/protocol";
import { legalMoves, type Color } from "../engine/rules";
import { ROLL_MS, buildFrames, eventToast } from "../game/anim";
import type { Controller } from "../game/controller";
import { t, type Lang, type StringKey } from "../game/i18n";
import { play, vibrate, type Sfx } from "../game/sound";
import type { Reaction } from "../online/useOnlineRoom";
import { Board, ROTATION, type Burst } from "./Board";
import { Dice } from "./Dice";
import { Results } from "./Results";

export interface GameViewProps {
  ctl: Controller;
  names: string[];
  lang: Lang;
  sound: boolean;
  haptics: boolean;
  reduced: boolean;
  onExit(): void;
  onAgain?(): void;
  onVerify(): void;
  reactions?: Reaction[];
  playerOfSeat?(seat: number): number;
  onEmoji?(emoji: string): void;
  banner?: string | null;
}

export function GameView(props: GameViewProps) {
  const { ctl, names, lang, reduced } = props;
  const state = ctl.state!;
  const colors = state.players.map((p) => p.color);
  const [display, setDisplay] = useState<number[][]>(state.tokens);
  const [hopping, setHopping] = useState<string | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [rolling, setRolling] = useState(false);
  const [toast, setToast] = useState<StringKey | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const fx = useRef({ sound: props.sound, haptics: props.haptics });
  fx.current = { sound: props.sound, haptics: props.haptics };
  const burstId = useRef(0);

  const sfx = (s: Sfx) => {
    if (fx.current.sound) play(s);
    if (fx.current.haptics) vibrate(s);
  };

  // Play the latest events: dice tumble, then a hop per cell, then captures.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
    const hasRoll = ctl.events.some((e) => e.type === "roll");
    const msg = eventToast(ctl.events);
    if (!ctl.prevTokens || reduced) {
      later(0, () => {
        setDisplay(state.tokens);
        setRolling(false);
        if (msg) setToast(msg);
      });
      if (hasRoll) later(0, () => sfx("dice"));
      return () => timers.forEach(clearTimeout);
    }
    let at = 0;
    if (hasRoll) {
      later(0, () => {
        setRolling(true);
        sfx("dice");
      });
      at = ROLL_MS;
      later(at, () => setRolling(false));
      if (ctl.events.some((e) => e.type === "roll" && e.value === 6)) later(at, () => sfx("six"));
    }
    if (msg) later(at, () => setToast(msg));
    for (const f of buildFrames(ctl.prevTokens, ctl.events)) {
      later(at, () => {
        setDisplay(f.tokens);
        for (const x of f.fx) {
          if (x.kind === "hop") {
            setHopping(`${x.player}-${x.token}`);
            sfx("hop");
          } else if (x.kind === "enter") {
            setHopping(`${x.player}-${x.token}`);
            sfx("enter");
          } else if (x.kind === "capture") {
            const [r, c] = TRACK[x.cell];
            const id = ++burstId.current;
            setBursts((b) => [...b, { id, row: r + 0.5, col: c + 0.5, color: colors[x.victim] }]);
            later(900, () => setBursts((b) => b.filter((y) => y.id !== id)));
            sfx("capture");
          } else if (x.kind === "home") {
            const [r, c] = tokenPosition(colors[x.player], 56, x.token);
            const id = ++burstId.current;
            setBursts((b) => [...b, { id, row: r, col: c, color: colors[x.player] }]);
            later(900, () => setBursts((b) => b.filter((y) => y.id !== id)));
            sfx("home");
          }
        }
      });
      at += f.ms;
    }
    later(at, () => {
      setHopping(null);
      setDisplay(state.tokens);
    });
    return () => timers.forEach(clearTimeout);
    // Replays only when a new batch of events arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctl.seq]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(id);
  }, [toast]);

  // Turn timer (online only).
  useEffect(() => {
    if (ctl.deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [ctl.deadline]);
  const secondsLeft = ctl.deadline === null ? null : Math.max(0, Math.ceil((ctl.deadline - now) / 1000));
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (secondsLeft !== null && secondsLeft <= 5 && secondsLeft > 0 && ctl.canAct && lastTick.current !== secondsLeft) {
      lastTick.current = secondsLeft;
      if (fx.current.sound) play("tick");
    }
  }, [secondsLeft, ctl.canAct]);

  const over = state.phase === "over";
  useEffect(() => {
    if (over) {
      const id = setTimeout(() => {
        if (fx.current.sound) play("win");
        if (fx.current.haptics) vibrate("win");
      }, 400);
      return () => clearTimeout(id);
    }
  }, [over]);

  const movable = useMemo(() => new Set(ctl.canAct && state.phase === "move" ? legalMoves(state) : []), [ctl.canAct, state]);
  const lastRoll = [...ctl.events].reverse().find((e) => e.type === "roll");
  const diceValue = lastRoll && lastRoll.type === "roll" ? lastRoll.value : (state.rolls.at(-1)?.value ?? 1);
  const allLocal = ctl.local.every(Boolean);
  const me = ctl.local.findIndex(Boolean);
  const rotation = !allLocal && me >= 0 ? ROTATION[colors[me]] : 0;
  const cur = state.current;
  const curName = names[cur];
  const canRoll = ctl.canAct && state.phase === "roll" && !rolling;

  let status: string;
  const winnerIsMe = over && ctl.local[state.finished[0]] && !allLocal;
  if (over) status = winnerIsMe ? t(lang, "youWin") : t(lang, "wins", { name: names[state.finished[0]] });
  else if (ctl.local[cur] && state.phase === "move" && ctl.canAct) status = t(lang, "pickToken");
  else if (ctl.local[cur] && !allLocal) status = t(lang, "yourTurn");
  else if (ctl.bots[cur]) status = t(lang, "botThinking", { name: curName });
  else status = t(lang, "turnOf", { name: curName });

  const reactionsFor = (player: number) =>
    (props.reactions ?? []).filter((r) => (props.playerOfSeat ? props.playerOfSeat(r.seat) : -1) === player);

  return (
    <div className="game">
      <header className="game-top">
        <button type="button" className="icon-btn" onClick={props.onExit} aria-label={t(lang, "leave")}>
          ←
        </button>
        <div className="fair-chip" title={t(lang, "fairInfo")}>
          <span aria-hidden="true">🔒</span> {t(lang, "fairChip")}
          <code>{ctl.fair.serverSeedHash.slice(0, 10) || "…"}</code>
        </div>
        {state.mode === "quick" && <span className="mode-chip">⚡ {t(lang, "quickMode")}</span>}
      </header>
      {props.banner && <div className="banner">{props.banner}</div>}

      <ol className="players" aria-label={t(lang, "players")}>
        {state.players.map((p, i) => {
          const place = state.finished.indexOf(i);
          const active = i === cur && !over;
          return (
            <li key={p.color} className={`pchip pc-${p.color}${active ? " active" : ""}`}>
              <span className="pdot" />
              <span className="pname">{names[i]}</span>
              {ctl.bots[i] && <span className="tag">{t(lang, "bot")}</span>}
              {ctl.offline?.[i] && !ctl.bots[i] && <span className="tag warn">{t(lang, "offline")}</span>}
              {place >= 0 && <span className="tag gold">{t(lang, `place${place + 1}` as StringKey)}</span>}
              {active && secondsLeft !== null && (
                <span className={`timer${secondsLeft <= 5 ? " low" : ""}`}>{t(lang, "secondsLeft", { s: secondsLeft })}</span>
              )}
              {reactionsFor(i).map((r) => (
                <span key={r.id} className="reaction" aria-hidden="true">
                  {r.emoji}
                </span>
              ))}
            </li>
          );
        })}
      </ol>

      <div className="stage">
        <div className="board-tilt">
          <Board
            colors={colors}
            tokens={display}
            movable={movable}
            current={cur}
            onPick={(ti) => ctl.move(ti)}
            rotation={rotation}
            hopping={hopping}
            bursts={bursts}
            labelFor={(p, ti) => `${names[p]} ${ti + 1}`}
          />
        </div>
        {toast && (
          <div className="toast" role="status">
            {t(lang, toast)}
          </div>
        )}
      </div>

      <div className={`dock dk-${colors[cur]}`}>
        <Dice
          value={diceValue}
          spin={ctl.seq}
          rolling={rolling}
          enabled={canRoll}
          onRoll={() => {
            setRolling(true);
            ctl.roll();
          }}
          label={t(lang, "tapToRoll")}
          color={colors[cur] as Color}
        />
        <div className="dock-text">
          <strong>{status}</strong>
          {canRoll && <span>{t(lang, "tapToRoll")}</span>}
        </div>
      </div>

      {props.onEmoji && (
        <div className="emoji-bar" aria-label={t(lang, "reactions")}>
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => props.onEmoji!(e)} aria-label={e}>
              {e}
            </button>
          ))}
        </div>
      )}

      {over && (
        <Results
          lang={lang}
          title={status}
          order={state.finished.map((i) => ({ name: names[i], color: colors[i] }))}
          reduced={reduced}
          onAgain={props.onAgain}
          onHome={props.onExit}
          onVerify={props.onVerify}
          card={{ mode: state.mode, fair: ctl.fair }}
        />
      )}
    </div>
  );
}
