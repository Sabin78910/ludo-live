import { memo } from "react";
import { armCell, HEX_SIZE, HEX_TRACK, hexHub, hexTokenPosition, hexYard, hexYardCentre } from "../engine/hex";
import { SIX_COLORS, SIX_GEO, BASE } from "../engine/rules";
import type { BoardProps } from "./Board";

const pct = (v: number) => `${(v / HEX_SIZE) * 100}%`;
const pts = (list: readonly (readonly [number, number])[]) => list.map(([y, x]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" ");
const deg = (arm: number) => 180 + 60 * arm;

function Star({ x, y }: { x: number; y: number }) {
  const p = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 0.17 : 0.38;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(x + r * Math.cos(a)).toFixed(3)},${(y + r * Math.sin(a)).toFixed(3)}`;
  }).join(" ");
  return <polygon points={p} fill="var(--star)" />;
}

/** Original 6-player board art: hexagon hub, six arms and six triangular yards. */
const HexArt = memo(function HexArt() {
  const hub = hexHub();
  const c = HEX_SIZE / 2;
  const cells: React.ReactNode[] = [];
  SIX_COLORS.forEach((color, arm) => {
    for (const lane of [-1, 0, 1])
      for (let d = 0; d < 6; d++) {
        const [y, x] = armCell(arm, lane, d);
        const home = lane === 0 && d < 5;
        const start = lane === 1 && d === 4;
        cells.push(
          <rect
            key={`${arm}-${lane}-${d}`}
            x={x - 0.47}
            y={y - 0.47}
            width="0.94"
            height="0.94"
            rx="0.12"
            transform={`rotate(${deg(arm)} ${x} ${y})`}
            fill={home || start ? `var(--${color})` : "var(--cell)"}
            stroke="var(--cell-line)"
            strokeWidth="0.04"
          />,
        );
      }
  });
  return (
    <svg className="board-art" viewBox={`0 0 ${HEX_SIZE} ${HEX_SIZE}`} aria-hidden="true">
      <circle cx={c} cy={c} r={c - 0.05} fill="var(--board)" />
      {SIX_COLORS.map((color) => {
        const [cy, cx] = hexYardCentre(color);
        return (
          <g key={color}>
            <polygon points={pts(hexYard(color))} fill={`var(--${color})`} stroke="var(--board)" strokeWidth="0.15" strokeLinejoin="round" />
            <circle cx={cx} cy={cy} r="1.45" fill="var(--yard)" />
            {[-0.6, 0.6].flatMap((dy) => [-0.6, 0.6].map((dx) => <circle key={`${dx}${dy}`} cx={cx + dx} cy={cy + dy} r="0.36" fill={`var(--${color})`} opacity="0.35" />))}
          </g>
        );
      })}
      {cells}
      {SIX_GEO.stars.map((i) => (
        <Star key={i} x={HEX_TRACK[i][1]} y={HEX_TRACK[i][0]} />
      ))}
      {SIX_COLORS.map((color, arm) => {
        const prev = hub[(arm + 5) % 6];
        const next = hub[arm];
        return <polygon key={color} points={pts([[c, c], prev, next])} fill={`var(--${color})`} stroke="var(--board)" strokeWidth="0.06" />;
      })}
    </svg>
  );
});

export function HexBoard({ colors, tokens, movable, current, onPick, hopping, bursts, labelFor }: BoardProps) {
  const items = tokens.flatMap((list, p) =>
    list.map((progress, ti) => {
      const [r, c] = hexTokenPosition(colors[p], progress, ti);
      return { p, ti, r, c, key: progress === BASE ? `b${p}-${ti}` : `${r.toFixed(2)},${c.toFixed(2)}` };
    }),
  );
  const counts = new Map<string, number>();
  items.forEach((it) => counts.set(it.key, (counts.get(it.key) ?? 0) + 1));
  const seen = new Map<string, number>();
  return (
    <div className="board hex">
      <HexArt />
      {items.map(({ p, ti, r, c, key }) => {
        const n = counts.get(key)!;
        const k = seen.get(key) ?? 0;
        seen.set(key, k + 1);
        const dx = n > 1 ? (k - (n - 1) / 2) * 0.3 : 0;
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

/** Screen rows for pods around the hexagon: yards 0..2 along the top, 5..3 along the bottom. */
export function hexRows(colors: readonly string[]): { top: (number | null)[]; bottom: (number | null)[] } {
  const at = (arm: number) => {
    const i = colors.indexOf(SIX_COLORS[arm]);
    return i >= 0 ? i : null;
  };
  return { top: [at(0), at(1), at(2)], bottom: [at(5), at(4), at(3)] };
}

