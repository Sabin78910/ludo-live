// Snakes & Ladders table: Ludo Live's own board art drawn in SVG, fair dice, computer or local players.
import { useCallback, useEffect, useRef, useState } from "react";
import { FairDealer } from "../engine/fair";
import type { Color } from "../engine/rules";
import { applySnakesRoll, cellOf, createSnakes, LADDERS, SNAKES, type SnakesEvent } from "../engine/snakes";
import { t, type Lang, type StringKey } from "../game/i18n";
import { play, vibrate, type Sfx } from "../game/sound";
import { Dice } from "./Dice";
import { Icon } from "./Icon";
import type { Proof } from "./Verify";

export interface SnakesSeat {
  name: string;
  color: Color;
  bot: boolean;
}

const STEP_MS = 170;
const JUMP_MS = 700;
const SNAKE_TONES = ["#22c55e", "#a855f7", "#f97316", "#14b8a6", "#e11d48"];
const TINT: Color[] = ["red", "green", "yellow", "blue"];

const center = (sq: number) => {
  const { col, row } = cellOf(sq);
  return { x: col * 10 + 5, y: row * 10 + 5 };
};

type Frame = { player: number; square: number; ms: number; sfx?: Sfx; pitch?: number; toast?: [StringKey, number?] };

/** Turns one roll's events into timed token positions. */
export function snakesFrames(events: SnakesEvent[]): Frame[] {
  const frames: Frame[] = [];
  for (const e of events) {
    if (e.type === "walk") e.path.forEach((sq, i) => frames.push({ player: e.player, square: sq, ms: STEP_MS, sfx: "hop", pitch: 440 + i * 60 }));
    if (e.type === "bounce") frames.push({ player: e.player, square: -1, ms: 0, toast: ["bounced"] });
    if (e.type === "ladder") frames.push({ player: e.player, square: e.to, ms: JUMP_MS, sfx: "home", toast: ["laddered", e.to] });
    if (e.type === "snake") frames.push({ player: e.player, square: e.to, ms: JUMP_MS, sfx: "capture", toast: ["snaked", e.to] });
    if (e.type === "threeSixes") frames.push({ player: e.player, square: -1, ms: 400, toast: ["threeSixes"] });
  }
  return frames;
}

export function SnakesGame(props: {
  seats: SnakesSeat[];
  clientSeed: string;
  lang: Lang;
  sound: boolean;
  haptics: boolean;
  reduced: boolean;
  onGameOver(won: boolean): void;
  onExit(): void;
  onAgain(): void;
  onVerify(p: Proof): void;
}) {
  const { seats, lang, reduced } = props;
  const [state, setState] = useState(() => createSnakes(seats.length));
  const [shown, setShown] = useState<number[]>(() => seats.map(() => 0));
  const [jumping, setJumping] = useState(false);
  const [dealer, setDealer] = useState<FairDealer | null>(null);
  const [busy, setBusy] = useState(false);
  const [dice, setDice] = useState({ value: 1, spin: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const clientSeeds = useRef([props.clientSeed]).current;
  const fx = useRef({ sound: props.sound, haptics: props.haptics });
  fx.current = { sound: props.sound, haptics: props.haptics };

  useEffect(() => {
    let live = true;
    void FairDealer.create().then((d) => live && setDealer(d));
    return () => void (live = false);
  }, []);

  const sfx = (s: Sfx, pitch?: number) => {
    if (fx.current.sound) play(s, pitch);
    if (fx.current.haptics) vibrate(s);
  };

  const roll = useCallback(async () => {
    if (!dealer || busy || state.phase !== "roll") return;
    setBusy(true);
    const value = await dealer.roll(clientSeeds, state.rollCount);
    const res = applySnakesRoll(state, value);
    setDice((d) => ({ value, spin: d.spin + 1 }));
    sfx("dice");
    const frames = snakesFrames(res.events);
    let at = reduced ? 120 : 650;
    for (const f of frames) {
      setTimeout(() => {
        if (f.square > 0) {
          setJumping(f.ms === JUMP_MS);
          setShown((s) => s.map((v, i) => (i === f.player ? f.square : v)));
        }
        if (f.sfx) sfx(f.sfx, f.pitch);
        if (f.toast) setToast(t(lang, f.toast[0], { n: f.toast[1] ?? "" }));
      }, at);
      at += reduced ? 40 : f.ms;
    }
    if (value === 6 && res.state.current === state.current && res.state.phase === "roll") setTimeout(() => setToast(t(lang, "rolledSix")), at);
    setTimeout(() => {
      setShown(res.state.positions);
      setState(res.state);
      setBusy(false);
      if (res.state.phase === "over") sfx("win");
    }, at + (reduced ? 60 : 250));
  }, [dealer, busy, state, clientSeeds, reduced, lang]);

  const botTurn = state.phase === "roll" && seats[state.current].bot;
  useEffect(() => {
    if (!botTurn || busy || !dealer) return;
    const id = setTimeout(() => void roll(), reduced ? 150 : 550);
    return () => clearTimeout(id);
  }, [botTurn, busy, dealer, roll, reduced]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(id);
  }, [toast]);

  const over = state.phase === "over" && !busy;
  useEffect(() => {
    if (!over || ended) return;
    setEnded(true);
    if (seats.some((s) => s.bot)) props.onGameOver(state.winner === 0);
  }, [over, ended, seats, state.winner, props]);

  const cur = seats[state.current];
  const canRoll = !busy && !!dealer && state.phase === "roll" && !cur.bot;
  const turnText = cur.bot || seats.filter((s) => !s.bot).length > 1 ? t(lang, "turnOf", { name: cur.name }) : t(lang, "yourTurn");

  return (
    <main className="screen snakes-screen">
      <header className="snakes-top">
        <button type="button" className="btn ghost back" onClick={props.onExit}>
          <Icon name="back" size={18} /> {t(lang, "home")}
        </button>
        <h1>{t(lang, "snakes")}</h1>
      </header>
      <div className="snakes-board-wrap">
        <SnakesBoard shown={shown} seats={seats} current={state.current} jumping={jumping} lang={lang} />
        {toast && (
          <p className="snakes-toast" role="status">
            {toast}
          </p>
        )}
      </div>
      <ol className="snakes-seats">
        {seats.map((s, i) => (
          <li key={i} className={i === state.current && !over ? "on" : ""} style={{ "--c": `var(--${s.color})` } as React.CSSProperties}>
            <span className="avatar">{s.bot ? <Icon name="bot" size={16} /> : s.name.slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{s.name}</strong>
              <small>{state.positions[i] ? t(lang, "square", { n: state.positions[i] }) : t(lang, "exactFinish")}</small>
            </span>
          </li>
        ))}
      </ol>
      <div className="snakes-dock">
        <Dice value={dice.value} spin={dice.spin} rolling={busy && !reduced} enabled={canRoll} onRoll={() => void roll()} label={t(lang, "tapToRoll")} color={cur.color} />
        <p className="snakes-turn">{state.phase === "roll" ? turnText : ""}</p>
      </div>
      {over && state.winner !== null && (
        <div className="results" role="dialog" aria-modal="true" aria-label={t(lang, "wins", { name: seats[state.winner].name })}>
          <div className="results-card">
            <Icon name="trophy" size={48} />
            <h2>{t(lang, "wins", { name: seats[state.winner].name })}</h2>
            <button type="button" className="btn primary big" onClick={props.onAgain}>
              {t(lang, "playAgain")}
            </button>
            <div className="row-btns">
              <button type="button" className="btn" onClick={props.onExit}>
                {t(lang, "home")}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  dealer &&
                  props.onVerify({ serverSeed: dealer.reveal(), serverSeedHash: dealer.serverSeedHash, clientSeeds, rolls: state.rolls, names: seats.map((s) => s.name) })
                }
              >
                <Icon name="shield" size={18} /> {t(lang, "verify")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SnakesBoard({ shown, seats, current, jumping, lang }: { shown: number[]; seats: SnakesSeat[]; current: number; jumping: boolean; lang: Lang }) {
  const cells = Array.from({ length: 100 }, (_, i) => i + 1);
  return (
    <svg className="snakes-board" viewBox="0 0 100 100" role="img" aria-label={t(lang, "snakes")}>
      {cells.map((sq) => {
        const { col, row } = cellOf(sq);
        const tint = TINT[(row + col) % 4];
        return (
          <g key={sq}>
            <rect x={col * 10} y={row * 10} width={10} height={10} fill={`var(--${tint})`} fillOpacity={(row + col) % 2 ? 0.1 : 0.26} />
            <text x={col * 10 + 1} y={row * 10 + 3.2} className={sq === 100 ? "sl-num goal" : "sl-num"}>
              {sq}
            </text>
          </g>
        );
      })}
      <text x={5} y={7.4} className="sl-crown" textAnchor="middle">★</text>
      {Object.entries(LADDERS).map(([a, b]) => (
        <Ladder key={a} from={center(+a)} to={center(b)} />
      ))}
      {Object.entries(SNAKES).map(([a, b], i) => (
        <Snake key={a} head={center(+a)} tail={center(b)} tone={SNAKE_TONES[i % SNAKE_TONES.length]} flip={i % 2 === 0} />
      ))}
      {shown.map((sq, i) => {
        if (sq <= 0) return null;
        const mates = shown.map((v, j) => [v, j]).filter(([v]) => v === sq).map(([, j]) => j);
        const k = mates.indexOf(i);
        const shared = mates.length > 1;
        const { x, y } = center(sq);
        const dx = shared ? (k % 2 ? 2.2 : -2.2) : 0;
        const dy = shared ? (k > 1 ? 2.2 : -2.2) : 0;
        return (
          <g
            key={i}
            className={`sl-token${i === current ? " on" : ""}${jumping ? " jump" : ""}`}
            style={{ transform: `translate(${x + dx}px, ${y + dy}px)` }}
          >
            <circle r={shared ? 2.5 : 3.1} fill={`var(--${seats[i].color})`} stroke="#fff" strokeWidth={0.6} />
            <circle r={shared ? 1 : 1.3} cx={-0.6} cy={-0.7} fill="#fff" fillOpacity={0.45} />
          </g>
        );
      })}
    </svg>
  );
}

function Ladder({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * 1.7;
  const ny = (dx / len) * 1.7;
  const rungs = Math.max(2, Math.floor(len / 3.2));
  return (
    <g className="sl-ladder">
      {[1, -1].map((s) => (
        <line key={s} x1={from.x + nx * s} y1={from.y + ny * s} x2={to.x + nx * s} y2={to.y + ny * s} />
      ))}
      {Array.from({ length: rungs }, (_, i) => {
        const f = (i + 0.5) / rungs;
        const x = from.x + dx * f;
        const y = from.y + dy * f;
        return <line key={i} className="rung" x1={x + nx} y1={y + ny} x2={x - nx} y2={y - ny} />;
      })}
    </g>
  );
}

function Snake({ head, tail, tone, flip }: { head: { x: number; y: number }; tail: { x: number; y: number }; tone: string; flip: boolean }) {
  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const len = Math.hypot(dx, dy);
  const w = Math.min(9, len / 3) * (flip ? 1 : -1);
  const nx = (-dy / len) * w;
  const ny = (dx / len) * w;
  const d = `M${head.x} ${head.y} C${head.x + dx / 3 + nx} ${head.y + dy / 3 + ny} ${head.x + (2 * dx) / 3 - nx} ${head.y + (2 * dy) / 3 - ny} ${tail.x} ${tail.y}`;
  const ang = (Math.atan2(head.y - (head.y + dy / 3 + ny), head.x - (head.x + dx / 3 + nx)) * 180) / Math.PI;
  return (
    <g className="sl-snake" style={{ "--tone": tone } as React.CSSProperties}>
      <path d={d} className="body" />
      <path d={d} className="scales" />
      <g transform={`translate(${head.x} ${head.y}) rotate(${ang})`}>
        <path d="M2.4 0 l1.6 -0.6 M2.4 0 l1.6 0.6" className="tongue" />
        <ellipse rx={2.8} ry={2.1} className="head" />
        <circle cx={0.9} cy={-0.9} r={0.55} fill="#fff" />
        <circle cx={0.9} cy={0.9} r={0.55} fill="#fff" />
        <circle cx={1.1} cy={-0.9} r={0.25} fill="#0b1026" />
        <circle cx={1.1} cy={0.9} r={0.25} fill="#0b1026" />
      </g>
    </g>
  );
}
