import { CATALOG, KINDS, isUnlocked, statValue, type Equipped, type Progress, type Skin, type SkinKind } from "../game/cosmetics";
import { t, type Lang, type StringKey } from "../game/i18n";

const KIND_KEY: Record<SkinKind, StringKey> = { board: "kindBoard", dice: "kindDice", token: "kindToken" };
const NEED_KEY = { games: "needGames", wins: "needWins", streak: "needStreak" } as const;

export function Collection({
  progress,
  equipped,
  lang,
  onEquip,
  onBack,
}: {
  progress: Progress;
  equipped: Equipped;
  lang: Lang;
  onEquip(skin: Skin): void;
  onBack(): void;
}) {
  return (
    <main className="screen collection">
      <button type="button" className="btn ghost back" onClick={onBack}>
        ← {t(lang, "back")}
      </button>
      <h1>{t(lang, "collection")}</h1>
      <p className="muted">{t(lang, "collectionSub")}</p>
      {KINDS.map((kind) => (
        <section key={kind} aria-label={t(lang, KIND_KEY[kind])}>
          <h2>{t(lang, KIND_KEY[kind])}</h2>
          <ul className="skins">
            {CATALOG.filter((s) => s.kind === kind).map((s) => {
              const open = isUnlocked(s, progress);
              const on = equipped[kind] === s.id;
              const name = t(lang, `skin_${s.id}` as StringKey);
              return (
                <li key={s.id} className={`skin${open ? "" : " locked"}`}>
                  <span className={`swatch sw-${kind}-${s.id}`} aria-hidden="true" />
                  <strong>{name}</strong>
                  {open ? (
                    <button type="button" className="btn small" aria-pressed={on} aria-label={`${name}: ${t(lang, on ? "equipped" : "equip")}`} onClick={() => onEquip(s)}>
                      {t(lang, on ? "equipped" : "equip")}
                    </button>
                  ) : (
                    <>
                      <small>{t(lang, NEED_KEY[s.stat], { n: s.need })}</small>
                      <progress max={s.need} value={Math.min(s.need, statValue(progress, s.stat))} aria-label={`${name}: ${t(lang, "locked")}`} />
                      <small>{t(lang, "progressOf", { have: Math.min(s.need, statValue(progress, s.stat)), need: s.need })}</small>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
