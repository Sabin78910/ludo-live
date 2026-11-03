import { useState } from "react";
import { t, type Lang } from "../game/i18n";
import { ONBOARDING_STEPS, nextStep } from "../game/onboarding";

const ART: Record<(typeof ONBOARDING_STEPS)[number], string> = {
  welcome: "ob-welcome",
  howToWin: "ob-win",
  fairDice: "ob-fair",
};

export function Onboarding({
  lang,
  name,
  onName,
  onLang,
  onDone,
  onPlay,
}: {
  lang: Lang;
  name: string;
  onName(n: string): void;
  onLang(): void;
  /** Close and stay on the home screen. */
  onDone(): void;
  /** Close and start a game against bots straight away. */
  onPlay(): void;
}) {
  const [step, setStep] = useState(0);
  const key = ONBOARDING_STEPS[step];
  const next = nextStep(step);
  return (
    <div className="results onboarding" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="results-card ob-card" key={key}>
        <button type="button" className="btn small ghost ob-skip" onClick={onDone}>
          {t(lang, "skip")}
        </button>
        <div className={`ob-art ${ART[key]}`} aria-hidden="true" />
        <h2 id="ob-title">{t(lang, `ob_${key}`)}</h2>
        <p className="muted">{t(lang, `ob_${key}_body`)}</p>
        {key === "welcome" && (
          <div className="ob-fields">
            <input aria-label={t(lang, "yourName")} placeholder={t(lang, "yourName")} value={name} maxLength={16} onChange={(e) => onName(e.target.value)} />
            <button type="button" className="btn small" onClick={onLang}>
              {t(lang, "language")}
            </button>
          </div>
        )}
        <ol className="ob-dots" aria-label={t(lang, "obProgress", { n: step + 1, total: ONBOARDING_STEPS.length })}>
          {ONBOARDING_STEPS.map((s, i) => (
            <li key={s} className={i === step ? "on" : ""} />
          ))}
        </ol>
        {next !== null ? (
          <button type="button" className="btn primary big" onClick={() => setStep(next)}>
            {t(lang, "next")}
          </button>
        ) : (
          <button type="button" className="btn primary big" onClick={onPlay}>
            {t(lang, "obPlay")}
          </button>
        )}
      </div>
    </div>
  );
}
