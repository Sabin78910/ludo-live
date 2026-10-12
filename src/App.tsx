import { useEffect, useState } from "react";
import { DIFFICULTIES, type Difficulty } from "./engine/bot";
import { newRoomCode, normalizeRoomCode } from "./engine/protocol";
import { seatColors } from "./engine/rules";
import { applyEquipped, loadEquipped, loadProgress, saveEquipped, type Equipped, type Skin } from "./game/cosmetics";
import { t, type StringKey } from "./game/i18n";
import { useInstallPrompt } from "./game/install";
import { loadSettings, saveSettings, type Settings } from "./game/settings";
import { roomFromSearch, roomSocketUrl, stripRoomParam } from "./game/share";
import { play, prefersReducedMotion } from "./game/sound";
import { useLocalGame, type LocalSeat } from "./game/useLocalGame";
import { Collection } from "./ui/Collection";
import { GameView } from "./ui/GameView";
import { OnlineRoomScreen } from "./ui/Online";
import { Verify, type Proof } from "./ui/Verify";

const WS_URL = import.meta.env.VITE_WS_URL;

type Screen =
  | { name: "home" }
  | { name: "setup"; mode: "bots" | "local" }
  | { name: "local"; seats: LocalSeat[]; quick: boolean; key: number }
  | { name: "online"; code: string; create: boolean }
  | { name: "collection" }
  | { name: "verify"; proof: Proof; back: Screen };

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [screen, setScreen] = useState<Screen>(() => {
    const code = typeof window !== "undefined" ? roomFromSearch(window.location.search) : null;
    return code && WS_URL ? { name: "online", code, create: false } : { name: "home" };
  });
  const [joinCode, setJoinCode] = useState(() => (typeof window !== "undefined" ? roomFromSearch(window.location.search) ?? "" : ""));
  const [equipped, setEquipped] = useState<Equipped>(() => loadEquipped(loadProgress()));
  const [rules, setRules] = useState(false);
  const { canInstall, install } = useInstallPrompt();
  const lang = settings.lang;

  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });

  useEffect(() => {
    document.documentElement.lang = lang === "ne" ? "ne" : "en";
    document.title = t(lang, "appName");
  }, [lang]);

  useEffect(() => applyEquipped(equipped), [equipped]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq?.addEventListener?.("change", on);
    return () => mq?.removeEventListener?.("change", on);
  }, []);

  useEffect(() => {
    if (screen.name === "online" && window.location.search.includes("room=")) {
      window.history.replaceState(null, "", stripRoomParam(window.location.href));
    }
  }, [screen]);

  const tap = () => settings.sound && play("tap");
  const myName = settings.name.trim() || t(lang, "you");

  if (screen.name === "collection") {
    return (
      <Collection
        progress={loadProgress()}
        equipped={equipped}
        lang={lang}
        onEquip={(skin: Skin) => {
          tap();
          const next = { ...equipped, [skin.kind]: skin.id };
          saveEquipped(next);
          setEquipped(next);
        }}
        onBack={() => setScreen({ name: "home" })}
      />
    );
  }

  if (screen.name === "verify") return <Verify proof={screen.proof} lang={lang} onBack={() => setScreen(screen.back)} />;

  if (screen.name === "local") {
    return (
      <LocalGame
        key={screen.key}
        seats={screen.seats}
        quick={screen.quick}
        settings={settings}
        reduced={reduced}
        onExit={() => setScreen({ name: "home" })}
        onAgain={() => setScreen({ ...screen, key: screen.key + 1 })}
        onVerify={(proof) => setScreen({ name: "verify", proof, back: { name: "home" } })}
      />
    );
  }

  if (screen.name === "online" && WS_URL) {
    return (
      <OnlineRoomScreen
        url={roomSocketUrl(WS_URL, screen.code)!}
        code={screen.code}
        create={screen.create}
        name={settings.name.trim()}
        clientSeed={settings.clientSeed}
        lang={lang}
        sound={settings.sound}
        haptics={settings.haptics}
        reduced={reduced}
        quick={settings.quick}
        onExit={() => setScreen({ name: "home" })}
        onVerify={(proof) => setScreen({ name: "verify", proof, back: { name: "home" } })}
      />
    );
  }

  if (screen.name === "setup") {
    const bots = screen.mode === "bots";
    const start = () => {
      tap();
      const colors = seatColors(settings.players);
      const seats: LocalSeat[] = colors.map((color, i) => ({
        color,
        name: bots ? (i === 0 ? myName : `${t(lang, "bot")} ${i}`) : i === 0 && settings.name ? settings.name : `${t(lang, "player")} ${i + 1}`,
        bot: bots && i > 0 ? settings.difficulty : null,
      }));
      setScreen({ name: "local", seats, quick: settings.quick, key: Date.now() });
    };
    return (
      <main className="screen setup">
        <button type="button" className="btn ghost back" onClick={() => setScreen({ name: "home" })}>
          ← {t(lang, "back")}
        </button>
        <h1>{t(lang, bots ? "playBots" : "passPlay")}</h1>
        <section className="glass form">
          <label className="field">
            <span>{t(lang, "yourName")}</span>
            <input value={settings.name} maxLength={16} onChange={(e) => update({ name: e.target.value })} placeholder={t(lang, "you")} />
          </label>
          <fieldset className="seg">
            <legend>{t(lang, "players")}</legend>
            {[2, 3, 4].map((n) => (
              <button key={n} type="button" aria-pressed={settings.players === n} onClick={() => update({ players: n })}>
                {n}
              </button>
            ))}
          </fieldset>
          {bots && (
            <fieldset className="seg">
              <legend>{t(lang, "difficulty")}</legend>
              {DIFFICULTIES.map((d: Difficulty) => (
                <button key={d} type="button" aria-pressed={settings.difficulty === d} onClick={() => update({ difficulty: d })}>
                  {t(lang, d as StringKey)}
                </button>
              ))}
            </fieldset>
          )}
          <label className="switch">
            <input type="checkbox" checked={settings.quick} onChange={(e) => update({ quick: e.target.checked })} />
            <span>
              ⚡ {t(lang, "quickMode")} <small>{t(lang, "quickModeSub")}</small>
            </span>
          </label>
          <button type="button" className="btn primary big" onClick={start}>
            {t(lang, "start")}
          </button>
        </section>
      </main>
    );
  }

  const code = normalizeRoomCode(joinCode);
  return (
    <main className="screen home">
      <div className="top-row">
        <button type="button" className="btn small ghost" onClick={() => update({ lang: lang === "en" ? "ne" : "en" })}>
          {t(lang, "language")}
        </button>
        <div className="toggles">
          <button type="button" className="icon-btn" aria-pressed={settings.sound} onClick={() => update({ sound: !settings.sound })} aria-label={t(lang, "sound")}>
            {settings.sound ? "🔊" : "🔇"}
          </button>
          <button type="button" className="icon-btn" aria-pressed={settings.haptics} onClick={() => update({ haptics: !settings.haptics })} aria-label={t(lang, "haptics")}>
            {settings.haptics ? "📳" : "📴"}
          </button>
        </div>
      </div>
      <div className="hero">
        <img src="./icon.svg" alt="" width="96" height="96" className="hero-icon" />
        <h1>{t(lang, "appName")}</h1>
        <p className="muted">{t(lang, "tagline")}</p>
        <p className="badges">
          <span className="badge">🔒 {t(lang, "fairChip")}</span>
          <span className="badge">🚫 {t(lang, "noAds")}</span>
        </p>
      </div>
      <nav className="modes">
        <button type="button" className="mode-card mc-red" onClick={() => (tap(), setScreen({ name: "setup", mode: "bots" }))}>
          <span className="mc-icon">🤖</span>
          <strong>{t(lang, "playBots")}</strong>
          <small>{t(lang, "playBotsSub")}</small>
        </button>
        <button type="button" className="mode-card mc-green" onClick={() => (tap(), setScreen({ name: "setup", mode: "local" }))}>
          <span className="mc-icon">📱</span>
          <strong>{t(lang, "passPlay")}</strong>
          <small>{t(lang, "passPlaySub")}</small>
        </button>
        <div className={`mode-card mc-blue online${WS_URL ? "" : " soon"}`}>
          <span className="mc-icon">🌐</span>
          <strong>{t(lang, "online")}</strong>
          {WS_URL ? (
            <>
              <small>{t(lang, "onlineSub")}</small>
              <div className="online-row">
                <button type="button" className="btn primary" onClick={() => (tap(), setScreen({ name: "online", code: newRoomCode(), create: true }))}>
                  {t(lang, "createRoom")}
                </button>
                <form
                  className="join"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (code) setScreen({ name: "online", code, create: false });
                  }}
                >
                  <input
                    aria-label={t(lang, "roomCode")}
                    placeholder={t(lang, "enterCode")}
                    value={joinCode}
                    maxLength={8}
                    autoCapitalize="characters"
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  />
                  <button type="submit" className="btn" disabled={!code}>
                    {t(lang, "join")}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <small className="soon-tag">{t(lang, "comingSoon")}</small>
          )}
        </div>
      </nav>
      <footer className="foot">
        <button type="button" className="btn small ghost" onClick={() => (tap(), setScreen({ name: "collection" }))}>
          {t(lang, "collection")}
        </button>
        <button type="button" className="btn small ghost" onClick={() => setRules(true)}>
          {t(lang, "rules")}
        </button>
        {canInstall && (
          <button type="button" className="btn small" onClick={install}>
            ⬇ {t(lang, "install")}
          </button>
        )}
        <a className="btn small ghost" href="https://sabin78910.github.io/privacy-policy/" target="_blank" rel="noreferrer">
          {t(lang, "privacy")}
        </a>
      </footer>
      {rules && (
        <div className="results" role="dialog" aria-modal="true" aria-label={t(lang, "rules")} onClick={() => setRules(false)}>
          <div className="results-card" onClick={(e) => e.stopPropagation()}>
            <h2>{t(lang, "rules")}</h2>
            <p>{t(lang, "rulesText")}</p>
            <p className="muted">{t(lang, "fairInfo")}</p>
            <button type="button" className="btn primary" onClick={() => setRules(false)}>
              {t(lang, "close")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function LocalGame({
  seats,
  quick,
  settings,
  reduced,
  onExit,
  onAgain,
  onVerify,
}: {
  seats: LocalSeat[];
  quick: boolean;
  settings: Settings;
  reduced: boolean;
  onExit(): void;
  onAgain(): void;
  onVerify(p: Proof): void;
}) {
  const ctl = useLocalGame(seats, quick, settings.clientSeed, reduced);
  const state = ctl.state!;
  return (
    <GameView
      ctl={ctl}
      names={seats.map((s) => s.name)}
      lang={settings.lang}
      sound={settings.sound}
      haptics={settings.haptics}
      reduced={reduced}
      onExit={onExit}
      onAgain={onAgain}
      onVerify={() =>
        ctl.fair.serverSeed &&
        onVerify({
          serverSeed: ctl.fair.serverSeed,
          serverSeedHash: ctl.fair.serverSeedHash,
          clientSeeds: ctl.fair.clientSeeds,
          rolls: state.rolls,
          names: seats.map((s) => s.name),
        })
      }
    />
  );
}
