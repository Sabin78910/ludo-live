import { useMemo } from "react";
import type { Color } from "../engine/rules";
import { t, type Lang, type StringKey } from "../game/i18n";

const CONFETTI = ["#EF3B4F", "#22C55E", "#FACC15", "#3B82F6", "#F5C451", "#ffffff"];

export function Results({
  lang,
  title,
  order,
  reduced,
  onAgain,
  onHome,
  onVerify,
}: {
  lang: Lang;
  title: string;
  order: { name: string; color: Color; delta?: number | null }[];
  reduced: boolean;
  onAgain?(): void;
  onHome(): void;
  onVerify(): void;
}) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 14) * 0.12,
        dur: 2.4 + ((i * 7) % 10) / 6,
        color: CONFETTI[i % CONFETTI.length],
        rot: (i * 53) % 360,
      })),
    [],
  );
  // Podium order on screen: 2nd, 1st, 3rd.
  const podium = [order[1], order[0], order[2]].map((p, i) => ({ p, place: [2, 1, 3][i] })).filter((x) => x.p);
  return (
    <div className="results" role="dialog" aria-modal="true" aria-label={title}>
      {!reduced && (
        <div className="confetti" aria-hidden="true">
          {pieces.map((c, i) => (
            <i
              key={i}
              style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, rotate: `${c.rot}deg` }}
            />
          ))}
        </div>
      )}
      <div className="results-card">
        <div className="trophy" aria-hidden="true">
          🏆
        </div>
        <h2>{title}</h2>
        <div className="podium">
          {podium.map(({ p, place }) => (
            <div key={place} className={`step step-${place}`}>
              <span className={`ptoken tok-${p.color}`}>
                <span className="token-body" />
              </span>
              <span className="step-name">{p.name}</span>
              <Delta delta={p.delta} />
              <div className={`block pc-${p.color}`}>{t(lang, `place${place}` as StringKey)}</div>
            </div>
          ))}
        </div>
        {order[3] && (
          <p className="fourth">
            {t(lang, "place4")}: {order[3].name} <Delta delta={order[3].delta} />
          </p>
        )}
        <div className="row-btns">
          {onAgain && (
            <button type="button" className="btn primary" onClick={onAgain}>
              {t(lang, "playAgain")}
            </button>
          )}
          <button type="button" className="btn" onClick={onVerify}>
            🔒 {t(lang, "verify")}
          </button>
          <button type="button" className="btn ghost" onClick={onHome}>
            {t(lang, "home")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Delta({ delta }: { delta?: number | null }) {
  if (delta === null || delta === undefined) return null;
  return <span className={`delta ${delta >= 0 ? "up" : "down"}`}>{delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`}</span>;
}
