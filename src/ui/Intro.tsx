import { useState, type ReactElement } from "react";
import { t, type Lang, type StringKey } from "../game/i18n";

const RED = "#E53935";
const GREEN = "#43A047";
const YELLOW = "#FDD835";
const BLUE = "#1E88E5";

const Token = ({ x, y, fill }: { x: number; y: number; fill: string }) => <circle cx={x} cy={y} r="11" fill={fill} stroke="#fff" strokeWidth="2" />;

function Track({ cells, children }: { cells: number; children?: ReactElement | ReactElement[] }) {
  return (
    <>
      {Array.from({ length: cells }, (_, i) => (
        <rect key={i} x={12 + i * 44} y="70" width="40" height="40" rx="8" fill="rgba(255,255,255,0.12)" />
      ))}
      {children}
    </>
  );
}

const ART: Record<"roll" | "move" | "capture", ReactElement> = {
  roll: (
    <>
      <rect x="70" y="30" width="100" height="100" rx="20" fill="#fff" />
      {[[100, 60], [140, 60], [100, 80], [140, 80], [100, 100], [140, 100]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill="#0B1026" />
      ))}
    </>
  ),
  move: (
    <Track cells={5}>
      <Token x={32} y={90} fill={GREEN} />
      <path d="M52 90 H150" stroke={YELLOW} strokeWidth="4" strokeDasharray="2 10" strokeLinecap="round" />
      <path d="M150 78 L168 90 L150 102 Z" fill={YELLOW} />
      <Token x={208} y={90} fill="rgba(67,160,71,0.45)" />
    </Track>
  ),
  capture: (
    <Track cells={5}>
      <Token x={32} y={90} fill={BLUE} />
      <path d="M52 90 H112" stroke={YELLOW} strokeWidth="4" strokeDasharray="2 10" strokeLinecap="round" />
      <Token x={120} y={90} fill={RED} />
      <path d="M130 70 C150 30 190 30 208 40" stroke={RED} strokeWidth="3" fill="none" strokeDasharray="4 6" />
      <path d="M200 30 L212 42 L196 46 Z" fill={RED} />
    </Track>
  ),
};

const STEPS = [
  { art: "roll", title: "introRoll", text: "introRollText" },
  { art: "move", title: "introMove", text: "introMoveText" },
  { art: "capture", title: "introCapture", text: "introCaptureText" },
] as const;

/** First-run teaching: three drawn steps, then the fair-dice promise. Skippable at every step. */
export function Intro({ lang, onPlay, onSkip }: { lang: Lang; onPlay(): void; onSkip(): void }) {
  const [i, setI] = useState(0);
  const total = STEPS.length + 1;
  const fair = i === STEPS.length;
  const step = fair ? null : STEPS[i];
  return (
    <main className="screen intro" aria-label={t(lang, "rules")}>
      <button type="button" className="btn ghost small intro-skip" onClick={onSkip}>
        {t(lang, "introSkip")}
      </button>
      <section className="glass intro-card">
        {step ? (
          <svg className="intro-art" viewBox="0 0 240 160" role="img" aria-label={t(lang, step.title as StringKey)}>
            {ART[step.art]}
          </svg>
        ) : (
          <div className="intro-art intro-lock" aria-hidden="true">
            🔒
          </div>
        )}
        <p className="muted intro-count">{t(lang, "introStep", { n: i + 1, total })}</p>
        <h1>{t(lang, step ? (step.title as StringKey) : "introFair")}</h1>
        <p>{t(lang, step ? (step.text as StringKey) : "introFairText")}</p>
        <div className="intro-dots" aria-hidden="true">
          {Array.from({ length: total }, (_, d) => (
            <span key={d} className={d === i ? "on" : ""} />
          ))}
        </div>
        {fair ? (
          <button type="button" className="btn primary big" onClick={onPlay}>
            {t(lang, "introPlay")}
          </button>
        ) : (
          <button type="button" className="btn primary big" onClick={() => setI(i + 1)}>
            {t(lang, "introNext")}
          </button>
        )}
      </section>
    </main>
  );
}
