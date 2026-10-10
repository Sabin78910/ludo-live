// CSS 3D dice cube. `value` picks the face shown; `spin` changes on every roll to replay the tumble.
const FACE_ROT: Record<number, string> = {
  1: "rotateX(0deg) rotateY(0deg)",
  2: "rotateX(0deg) rotateY(-90deg)",
  3: "rotateX(-90deg) rotateY(0deg)",
  4: "rotateX(90deg) rotateY(0deg)",
  5: "rotateX(0deg) rotateY(90deg)",
  6: "rotateX(180deg) rotateY(0deg)",
};

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const FACES = [
  { n: 1, cls: "f-front" },
  { n: 2, cls: "f-right" },
  { n: 3, cls: "f-top" },
  { n: 4, cls: "f-bottom" },
  { n: 5, cls: "f-left" },
  { n: 6, cls: "f-back" },
];

export function Dice({
  value,
  spin,
  rolling,
  enabled,
  onRoll,
  label,
  color,
}: {
  value: number;
  spin: number;
  rolling: boolean;
  enabled: boolean;
  onRoll(): void;
  label: string;
  color: string;
}) {
  return (
    <button
      type="button"
      className={`dice-btn${enabled ? " ready" : ""}`}
      onClick={onRoll}
      disabled={!enabled}
      aria-label={label}
      style={{ "--glow": `var(--${color})` } as React.CSSProperties}
    >
      <div className="dice-scene">
        <div key={spin} className={`dice${rolling ? " rolling" : ""}`} style={{ "--final": FACE_ROT[value] ?? FACE_ROT[1] } as React.CSSProperties}>
          {FACES.map((f) => (
            <div key={f.n} className={`face ${f.cls}`}>
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className={PIPS[f.n].includes(i) ? "pip" : "pip off"} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <span className="dice-shadow" />
    </button>
  );
}
