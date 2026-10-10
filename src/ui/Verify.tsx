import { useEffect, useState } from "react";
import { verifyRolls, type VerifyResult } from "../engine/fair";
import { t, type Lang } from "../game/i18n";

export interface Proof {
  serverSeed: string;
  serverSeedHash: string;
  clientSeeds: string[];
  rolls: { n: number; value: number; player: number }[];
  names: string[];
}

/** Recomputes the commitment and every roll in the browser. */
export function Verify({ proof, lang, onBack }: { proof: Proof; lang: Lang; onBack(): void }) {
  const [res, setRes] = useState<VerifyResult | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true;
    void verifyRolls(proof).then((r) => live && setRes(r));
    return () => {
      live = false;
    };
  }, [proof]);
  const ok = res?.checks.filter((c) => c.ok).length ?? 0;
  const copy = async () => {
    const { serverSeed, serverSeedHash, clientSeeds, rolls } = proof;
    try {
      await navigator.clipboard.writeText(JSON.stringify({ serverSeed, serverSeedHash, clientSeeds, rolls: rolls.map((r) => ({ n: r.n, value: r.value })) }));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <main className="screen verify">
      <button type="button" className="btn ghost back" onClick={onBack}>
        ← {t(lang, "back")}
      </button>
      <h1>🔒 {t(lang, "verifyTitle")}</h1>
      <p className="muted">{t(lang, "verifyIntro")}</p>
      <dl className="proof glass">
        <dt>{t(lang, "serverSeedHash")}</dt>
        <dd>
          <code>{proof.serverSeedHash}</code>
        </dd>
        <dt>{t(lang, "serverSeed")}</dt>
        <dd>
          <code>{proof.serverSeed}</code>
        </dd>
        <dt>{t(lang, "clientSeeds")}</dt>
        <dd>
          <code>{proof.clientSeeds.join(" | ")}</code>
        </dd>
      </dl>
      <p className="muted small">
        roll n = first byte b &lt; 252 of HMAC-SHA256(seed, "{proof.clientSeeds.join("|")}:n") → (b mod 6) + 1
      </p>
      {!res ? (
        <p>{t(lang, "verifying")}</p>
      ) : (
        <>
          <div className={`verdict ${res.allOk ? "good" : "bad"}`} role="status">
            <strong>{res.hashOk ? "✓ " + t(lang, "hashMatches") : "✗ " + t(lang, "hashMismatch")}</strong>
            <span>{t(lang, "rollsVerified", { ok, total: res.checks.length })}</span>
          </div>
          <div className="table-wrap glass">
            <table>
              <thead>
                <tr>
                  <th>{t(lang, "rollNo")}</th>
                  <th>{t(lang, "player")}</th>
                  <th>{t(lang, "claimed")}</th>
                  <th>{t(lang, "computed")}</th>
                  <th aria-label="ok" />
                </tr>
              </thead>
              <tbody>
                {res.checks.map((c, i) => (
                  <tr key={c.n} className={c.ok ? "" : "bad"}>
                    <td>{c.n + 1}</td>
                    <td>{proof.names[proof.rolls[i].player] ?? "?"}</td>
                    <td>{c.claimed}</td>
                    <td>{c.expected}</td>
                    <td>{c.ok ? "✓" : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn" onClick={copy}>
            {copied ? t(lang, "copied") : t(lang, "copyProof")}
          </button>
        </>
      )}
    </main>
  );
}
