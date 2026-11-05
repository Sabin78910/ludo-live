import { useEffect, useMemo, useState } from "react";
import { trophyProgress } from "../game/stats";
import type { Color } from "../engine/rules";
import { localDigits, t, type Lang, type StringKey } from "../game/i18n";
import type { DiceLuck } from "../game/luck";
import { Icon } from "./Icon";

const CONFETTI = ["#EF3B4F", "#22C55E", "#FACC15", "#3B82F6", "#F5C451", "#ffffff"];

export function Results({
  lang,
  title,
  order,
  reduced,
  onAgain,
  onHome,
  onVerify,
  luck = [],
  wins,
  won,
  sparks,
}: {
  lang: Lang;
  title: string;
  order: { name: string; color: Color }[];
  reduced: boolean;
  onAgain?(): void;
  onHome(): void;
  onVerify(): void;
  luck?: (DiceLuck & { name: string; color: Color })[];
  /** Lifetime wins after this game; shows progress to the next trophy. */
  wins?: number;
  /** This game was won, so the bar fills from the previous total. */
  won?: boolean;
  /** Sparks earned by this game; counts up so the reward is seen landing. */
  sparks?: number;
}) {
  const [shown, setShown] = useState(reduced ? (sparks ?? 0) : 0);
  useEffect(() => {
    if (!sparks || reduced) return;
    const start = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 900);
      setShown(Math.round(sparks * (1 - Math.pow(1 - k, 3))));
      if (k < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [sparks, reduced]);
  const before = wins !== undefined && won ? trophyProgress(wins - 1) : null;
  const after = wins !== undefined ? trophyProgress(wins) : null;
  // Start the bar where it was before this win, then fill it on the next frame.
  const [fill, setFill] = useState(() => (reduced || !before || before.next !== after?.next ? after?.fraction ?? 0 : before.fraction));
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(after?.fraction ?? 0));
    return () => cancelAnimationFrame(id);
  }, [after?.fraction]);
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
          <Icon name="trophy" size={56} />
        </div>
        <h2>{title}</h2>
        <div className="podium">
          {podium.map(({ p, place }) => (
            <div key={place} className={`step step-${place}`}>
              <span className={`ptoken tok-${p.color}`}>
                <span className="token-body" />
              </span>
              <span className="step-name">{p.name}</span>
              <div className={`block pc-${p.color}`}>{t(lang, `place${place}` as StringKey)}</div>
            </div>
          ))}
        </div>
        {order[3] && (
          <p className="fourth">
            {t(lang, "place4")}: {order[3].name}
          </p>
        )}
        {luck.some((l) => l.rolls > 0) && (
          <section className="luck" aria-label={t(lang, "diceThisGame")}>
            <h3>{t(lang, "diceThisGame")}</h3>
            <ul>
              {luck.map((l) => {
                const top = Math.max(1, ...l.faces);
                return (
                  <li key={l.player}>
                    <span className={`dot pc-${l.color}`} aria-hidden="true" />
                    <span className="luck-name">{l.name}</span>
                    <span className="faces" aria-hidden="true">
                      {l.faces.map((f, i) => (
                        <i key={i} className={i === 5 ? "six" : ""} style={{ height: `${Math.max(8, (f / top) * 100)}%` }} />
                      ))}
                    </span>
                    <span className="luck-sixes">
                      {t(lang, "sixesVsFair", {
                        n: localDigits(lang, l.sixes),
                        e: localDigits(lang, l.expectedSixes),
                        r: localDigits(lang, l.rolls),
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {sparks ? (
          <p className="sparks-earned" role="status" aria-label={t(lang, "sparksEarned", { n: sparks })}>
            <Icon name="spark" size={20} /> +{shown}
          </p>
        ) : null}
        {after && wins !== undefined && (
          <div className={`trophy-track${won && after.fresh ? " fresh" : ""}`}>
            <p>
              {won && after.fresh
                ? t(lang, "trophyNew", { n: wins })
                : after.next === null
                  ? t(lang, "trophyMax")
                  : t(lang, "trophyNext", { left: after.next - wins, next: after.next })}
            </p>
            <div className="bar" aria-hidden="true">
              <i style={{ width: `${(won && after.fresh ? 1 : fill) * 100}%` }} />
            </div>
          </div>
        )}
        <div className="row-btns">
          {onAgain && (
            <button type="button" className="btn primary" onClick={onAgain}>
              {t(lang, "playAgain")}
            </button>
          )}
          <button type="button" className="btn" onClick={onVerify}>
            <Icon name="shield" size={18} /> {t(lang, "verify")}
          </button>
          <button type="button" className="btn ghost" onClick={onHome}>
            {t(lang, "home")}
          </button>
        </div>
      </div>
    </div>
  );
}
