import { useMemo } from "react";
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
}: {
  lang: Lang;
  title: string;
  order: { name: string; color: Color }[];
  reduced: boolean;
  onAgain?(): void;
  onHome(): void;
  onVerify(): void;
  luck?: (DiceLuck & { name: string; color: Color })[];
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
