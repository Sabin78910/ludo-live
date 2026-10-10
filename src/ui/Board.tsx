import { memo } from "react";
import { BASE_ORIGIN, GRID, HOME_COLUMN, TRACK, tokenPosition } from "../engine/board";
import { COLORS, START_OFFSET, STAR_INDICES, type Color } from "../engine/rules";

export interface Burst {
  id: number;
  row: number;
  col: number;
  color: Color;
}

export const ROTATION: Record<Color, number> = { blue: 0, red: -90, green: 180, yellow: 90 };

const pct = (v: number) => `${(v / GRID) * 100}%`;

const BoardArt = memo(function BoardArt() {
  const startIdx = new Map(COLORS.map((c) => [START_OFFSET[c], c]));
  return (
    <svg className="board-art" viewBox={`0 0 ${GRID} ${GRID}`} aria-hidden="true">
      <defs>
        {COLORS.map((c) => (
          <linearGradient key={c} id={`g-${c}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`var(--${c}-hi)`} />
            <stop offset="1" stopColor={`var(--${c})`} />
          </linearGradient>
        ))}
      </defs>
      <rect x="0" y="0" width={GRID} height={GRID} rx="0.4" fill="var(--board)" />
      {COLORS.map((c) => {
        const [r, col] = BASE_ORIGIN[c];
        return (
          <g key={c}>
            <rect x={col + 0.12} y={r + 0.12} width="5.76" height="5.76" rx="0.6" fill={`url(#g-${c})`} />
            <rect x={col + 0.9} y={r + 0.9} width="4.2" height="4.2" rx="0.5" fill="var(--yard)" />
            {[
              [1.9, 1.9],
              [1.9, 4.1],
              [4.1, 1.9],
              [4.1, 4.1],
            ].map(([sr, sc]) => (
              <circle key={`${sr}${sc}`} cx={col + sc} cy={r + sr} r="0.55" fill={`var(--${c})`} opacity="0.22" />
            ))}
          </g>
        );
      })}
      {TRACK.map(([r, c], i) => {
        const start = startIdx.get(i);
        return (
          <g key={i}>
            <rect
              x={c + 0.04}
              y={r + 0.04}
              width="0.92"
              height="0.92"
              rx="0.14"
              fill={start ? `var(--${start})` : "var(--cell)"}
              stroke="var(--cell-line)"
              strokeWidth="0.03"
            />
            {STAR_INDICES.includes(i) && <Star x={c + 0.5} y={r + 0.5} />}
            {start && <path d={`M${c + 0.3} ${r + 0.5} L${c + 0.7} ${r + 0.5} M${c + 0.55} ${r + 0.35} L${c + 0.7} ${r + 0.5} L${c + 0.55} ${r + 0.65}`} stroke="#fff" strokeWidth="0.08" fill="none" strokeLinecap="round" transform={`rotate(${startArrow(start)} ${c + 0.5} ${r + 0.5})`} />}
          </g>
        );
      })}
      {COLORS.map((color) =>
        HOME_COLUMN[color].map(([r, c], i) => (
          <rect key={`${color}${i}`} x={c + 0.04} y={r + 0.04} width="0.92" height="0.92" rx="0.14" fill={`var(--${color})`} opacity={0.75 + i * 0.05} />
        )),
      )}
      <polygon points="6,6 7.5,7.5 6,9" fill="var(--red)" />
      <polygon points="6,6 9,6 7.5,7.5" fill="var(--green)" />
      <polygon points="9,6 9,9 7.5,7.5" fill="var(--yellow)" />
      <polygon points="6,9 9,9 7.5,7.5" fill="var(--blue)" />
      <circle cx="7.5" cy="7.5" r="0.42" fill="var(--gold)" />
    </svg>
  );
});

function startArrow(c: Color): number {
  return { red: 0, green: 90, yellow: 180, blue: 270 }[c];
}

function Star({ x, y }: { x: number; y: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? 0.36 : 0.15;
    return `${x + Math.cos(a) * rad},${y + Math.sin(a) * rad}`;
  }).join(" ");
  return <polygon points={pts} fill="var(--star)" />;
}

export interface BoardProps {
  colors: Color[];
  tokens: number[][];
  movable: Set<number>;
  current: number;
  onPick(token: number): void;
  rotation: number;
  hopping: string | null;
  bursts: Burst[];
  labelFor(player: number, token: number): string;
}

export function Board({ colors, tokens, movable, current, onPick, rotation, hopping, bursts, labelFor }: BoardProps) {
  // Group tokens per cell so stacked tokens fan out instead of hiding each other.
  const items = tokens.flatMap((list, p) =>
    list.map((progress, ti) => {
      const [r, c] = tokenPosition(colors[p], progress, ti);
      return { p, ti, r, c, key: `${r.toFixed(2)},${c.toFixed(2)}` };
    }),
  );
  const counts = new Map<string, number>();
  items.forEach((it) => counts.set(it.key, (counts.get(it.key) ?? 0) + 1));
  const seen = new Map<string, number>();
  return (
    <div className="board" style={{ "--rot": `${rotation}deg` } as React.CSSProperties}>
      <BoardArt />
      {items.map(({ p, ti, r, c, key }) => {
        const n = counts.get(key)!;
        const k = seen.get(key) ?? 0;
        seen.set(key, k + 1);
        const dx = n > 1 ? (k - (n - 1) / 2) * 0.28 : 0;
        const can = p === current && movable.has(ti);
        const id = `${p}-${ti}`;
        return (
          <button
            key={id}
            type="button"
            className={`token tok-${colors[p]}${can ? " movable" : ""}${hopping === id ? " hop" : ""}${n > 1 ? " stacked" : ""}`}
            style={{ left: pct(c + dx), top: pct(r), zIndex: Math.round(r * 10) + (can ? 500 : 0) }}
            disabled={!can}
            onClick={() => onPick(ti)}
            aria-label={labelFor(p, ti)}
          >
            <span className="token-body" />
          </button>
        );
      })}
      {bursts.map((b) => (
        <div key={b.id} className={`burst burst-${b.color}`} style={{ left: pct(b.col), top: pct(b.row) }} aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ "--a": `${i * 36}deg` } as React.CSSProperties} />
          ))}
        </div>
      ))}
    </div>
  );
}
