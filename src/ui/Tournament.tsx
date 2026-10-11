import { useMemo } from "react";
import { t, type Lang, type StringKey } from "../game/i18n";
import { champion, currentTable, type TableId, type Tournament as Bracket } from "../game/tournament";

const TABLE_KEY: Record<TableId, StringKey> = { semi1: "tableSemi1", semi2: "tableSemi2", final: "tableFinal" };
export const tableLabel = (lang: Lang, id: TableId) => t(lang, TABLE_KEY[id]);

const CONFETTI = ["#EF3B4F", "#22C55E", "#FACC15", "#3B82F6", "#F5C451", "#ffffff"];

/** Bracket between games; once the final is played it becomes the champion screen. */
export function BracketScreen({
  lang,
  bracket,
  reduced,
  onPlay,
  onVerifyTable,
  onHome,
}: {
  lang: Lang;
  bracket: Bracket;
  reduced: boolean;
  onPlay(id: TableId): void;
  onVerifyTable(id: TableId): void;
  onHome(): void;
}) {
  const next = currentTable(bracket);
  const champ = champion(bracket);
  const pieces = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 14) * 0.12, dur: 2.4 + ((i * 7) % 10) / 6, color: CONFETTI[i % CONFETTI.length], rot: (i * 53) % 360 })),
    [],
  );
  return (
    <main className="screen bracket">
      {champ !== null && !reduced && (
        <div className="confetti" aria-hidden="true">
          {pieces.map((c, i) => (
            <i key={i} style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, rotate: `${c.rot}deg` }} />
          ))}
        </div>
      )}
      <h1>🏆 {champ !== null ? t(lang, "championIs", { name: bracket.names[champ] }) : t(lang, "bracket")}</h1>
      {bracket.tables.map((table) => (
        <section key={table.id} className="glass form" aria-label={tableLabel(lang, table.id)}>
          <h2>{tableLabel(lang, table.id)}</h2>
          {table.seats.length === 0 ? (
            <p className="muted">{t(lang, "waiting")}</p>
          ) : (
            <ol>
              {(table.result ?? table.seats).map((p, place) => (
                <li key={p}>
                  {table.result && place < 2 ? "✓ " : ""}
                  {bracket.names[p]}
                </li>
              ))}
            </ol>
          )}
          {next?.id === table.id && (
            <button type="button" className="btn primary big" onClick={() => onPlay(table.id)}>
              {t(lang, "playTable", { name: tableLabel(lang, table.id) })}
            </button>
          )}
        </section>
      ))}
      {champ !== null && (
        <section className="glass form" aria-label={t(lang, "verifyAll")}>
          <h2>🔒 {t(lang, "verifyAll")}</h2>
          {bracket.tables.map((table) => (
            <button key={table.id} type="button" className="btn" onClick={() => onVerifyTable(table.id)}>
              {tableLabel(lang, table.id)}
            </button>
          ))}
        </section>
      )}
      <button type="button" className="btn ghost" onClick={onHome}>
        {t(lang, "home")}
      </button>
    </main>
  );
}
