import { useEffect, useState } from "react";
import { DIFFICULTIES, type Difficulty } from "./engine/bot";
import { newRoomCode, normalizeRoomCode } from "./engine/protocol";
import { seatColors } from "./engine/rules";
import { t, type StringKey } from "./game/i18n";
import { useInstallPrompt } from "./game/install";
import { BOARD_THEMES, loadSettings, saveSettings, type Settings } from "./game/settings";
import { roomFromSearch, roomSocketUrl, stripRoomParam } from "./game/share";
import { play, prefersReducedMotion } from "./game/sound";
import { forgetFriend, loadFriends, rememberPlayers, saveFriends, type Friend } from "./game/friends";
import { dayKey, liveStreak, loadStats, recordGame, saveStats } from "./game/stats";
import { useLocalGame, type LocalSeat } from "./game/useLocalGame";
import { needsOnboarding } from "./game/onboarding";
import { GameView } from "./ui/GameView";
import { Onboarding } from "./ui/Onboarding";
import { Icon } from "./ui/Icon";
import { OnlineRoomScreen } from "./ui/Online";
import { Verify, type Proof } from "./ui/Verify";

const WS_URL = import.meta.env.VITE_WS_URL;

type Screen =
  | { name: "home" }
  | { name: "setup"; mode: "bots" | "local" }
  | { name: "local"; seats: LocalSeat[]; quick: boolean; master: boolean; teams: boolean; key: number }
  | { name: "online"; code: string; create: boolean }
  | { name: "verify"; proof: Proof; back: Screen };

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [screen, setScreen] = useState<Screen>(() => {
    const code = typeof window !== "undefined" ? roomFromSearch(window.location.search) : null;
    return code && WS_URL ? { name: "online", code, create: false } : { name: "home" };
  });
  const [joinCode, setJoinCode] = useState(() => (typeof window !== "undefined" ? roomFromSearch(window.location.search) ?? "" : ""));
  const [rules, setRules] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(() => needsOnboarding(settings.onboarded, screen.name === "online"));
  const [stats, setStats] = useState(loadStats);
  const [friends, setFriends] = useState<Friend[]>(loadFriends);
  const changeFriends = (fn: (f: Friend[]) => Friend[]) =>
    setFriends((f) => {
      const next = fn(f);
      saveFriends(next);
      return next;
    });
  const onGameOver = (won: boolean) =>
    setStats((s) => {
      const next = recordGame(s, won, dayKey(new Date()));
      saveStats(next);
      return next;
    });
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

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("marks", settings.marks);
    root.classList.toggle("large-text", settings.largeText);
    root.dataset.board = settings.board;
  }, [settings.marks, settings.largeText, settings.board]);

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

  if (screen.name === "verify") return <Verify proof={screen.proof} lang={lang} onBack={() => setScreen(screen.back)} />;

  if (screen.name === "local") {
    return (
      <LocalGame
        key={screen.key}
        seats={screen.seats}
        quick={screen.quick}
        master={screen.master}
        teams={screen.teams}
        settings={settings}
        reduced={reduced}
        onGameOver={onGameOver}
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
        master={settings.master}
        teams={settings.teams}
        onExit={() => setScreen({ name: "home" })}
        onVerify={(proof) => setScreen({ name: "verify", proof, back: { name: "home" } })}
        onPlayers={(names) => changeFriends((f) => rememberPlayers(f, names, Date.now()))}
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
      setScreen({ name: "local", seats, quick: settings.quick, master: settings.master, teams: settings.teams && settings.players === 4, key: Date.now() });
    };
    return (
      <main className="screen setup">
        <button type="button" className="btn ghost back" onClick={() => setScreen({ name: "home" })}>
          <Icon name="back" size={18} /> {t(lang, "back")}
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
              <small className="seg-note">{t(lang, `${settings.difficulty}Sub`)}</small>
            </fieldset>
          )}
          <label className="switch">
            <input type="checkbox" checked={settings.quick} onChange={(e) => update({ quick: e.target.checked })} />
            <span>
              <Icon name="bolt" /> {t(lang, "quickMode")} <small>{t(lang, "quickModeSub")}</small>
            </span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={settings.master} onChange={(e) => update({ master: e.target.checked })} />
            <span>
              <Icon name="target" /> {t(lang, "masterRule")} <small>{t(lang, "masterRuleSub")}</small>
            </span>
          </label>
          {settings.players === 4 && (
            <label className="switch">
              <input type="checkbox" checked={settings.teams} onChange={(e) => update({ teams: e.target.checked })} />
              <span>
                <Icon name="team" /> {t(lang, "teamsMode")} <small>{t(lang, "teamsModeSub")}</small>
              </span>
            </label>
          )}
          <fieldset className="seg boards">
            <legend>{t(lang, "boardTheme")}</legend>
            {BOARD_THEMES.map((b) => (
              <button key={b} type="button" aria-pressed={settings.board === b} onClick={() => update({ board: b })}>
                <span className={`swatch sw-${b}`} aria-hidden="true" />
                {t(lang, `board_${b}`)}
              </button>
            ))}
          </fieldset>
          <button type="button" className="btn primary big" onClick={start}>
            {t(lang, "start")}
          </button>
        </section>
      </main>
    );
  }

  const startBots = (s: Settings) => {
    const colors = seatColors(s.players);
    const seats: LocalSeat[] = colors.map((color, i) => ({
      color,
      name: i === 0 ? s.name.trim() || t(s.lang, "you") : `${t(s.lang, "bot")} ${i}`,
      bot: i > 0 ? s.difficulty : null,
    }));
    setScreen({ name: "local", seats, quick: s.quick, master: s.master, teams: s.teams && s.players === 4, key: Date.now() });
  };
  const finishOnboarding = (play: boolean) => {
    setOnboarding(false);
    update({ onboarded: true });
    if (play) startBots({ ...settings, onboarded: true });
  };

  const code = normalizeRoomCode(joinCode);
  return (
    <main className="screen home lobby-screen">
      <header className="lobby-top">
        <div className="profile">
          <span className="profile-avatar" aria-hidden="true">
            {(settings.name.trim() || t(lang, "you")).slice(0, 1).toUpperCase()}
          </span>
          <span className="profile-text">
            <strong>{settings.name.trim() || t(lang, "you")}</strong>
            <small>
              {stats.played > 0 ? t(lang, "statsLine", { won: stats.won, played: stats.played }) : t(lang, "tagline")}
            </small>
          </span>
        </div>
        <button type="button" className="chip-btn" onClick={() => update({ lang: lang === "en" ? "ne" : "en" })}>
          {t(lang, "language")}
        </button>
        <button type="button" className="icon-btn" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)} aria-label={t(lang, "settings")}>
          <Icon name="gear" />
        </button>
      </header>

      <section className="hero-card">
        <div className="hero-board" aria-hidden="true">
          <img src="./icon.svg" alt="" width="132" height="132" />
        </div>
        <h1>{t(lang, "appName")}</h1>
        <p className="hero-sub">
          <span>
            <Icon name="shield" size={16} /> {t(lang, "fairChip")}
          </span>
          <span>
            <Icon name="noAds" size={16} /> {t(lang, "noAds")}
          </span>
          {liveStreak(stats, dayKey(new Date())) > 0 && <span className="streak"><Icon name="bolt" size={16} /> {t(lang, "streakLine", { n: liveStreak(stats, dayKey(new Date())) })}</span>}
        </p>
        <button type="button" className="btn primary big play-now" onClick={() => (tap(), startBots(settings))}>
          {t(lang, "playNow")}
        </button>
      </section>

      <nav className="tiles" aria-label={t(lang, "modes")}>
        <button type="button" className="tile tl-red" onClick={() => (tap(), setScreen({ name: "setup", mode: "bots" }))}>
          <span className="tile-icon"><Icon name="bot" size={30} /></span>
          <strong>{t(lang, "playBots")}</strong>
          <small>{t(lang, "playBotsSub")}</small>
        </button>
        <button type="button" className="tile tl-green" onClick={() => (tap(), setScreen({ name: "setup", mode: "local" }))}>
          <span className="tile-icon"><Icon name="phone" size={30} /></span>
          <strong>{t(lang, "passPlay")}</strong>
          <small>{t(lang, "passPlaySub")}</small>
        </button>
        <div className={`tile tile-wide tl-blue online${WS_URL ? "" : " soon"}`}>
          <span className="tile-icon"><Icon name="globe" size={30} /></span>
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
      {WS_URL && friends.length > 0 && (
        <section className="friends" aria-labelledby="friends-h">
          <h2 id="friends-h">{t(lang, "playAgainWith")}</h2>
          <ul>
            {friends.map((f) => (
              <li key={f.name}>
                <button type="button" className="friend" onClick={() => (tap(), setScreen({ name: "online", code: newRoomCode(), create: true }))}>
                  <span className="avatar">{f.name.slice(0, 1).toUpperCase()}</span>
                  <span>
                    <strong>{f.name}</strong>
                    <small>{t(lang, "gamesTogether", { n: f.games })}</small>
                  </span>
                </button>
                <button type="button" className="icon-btn forget" aria-label={t(lang, "forget", { name: f.name })} onClick={() => changeFriends((l) => forgetFriend(l, f.name))}>
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small">{t(lang, "friendsNote")}</p>
        </section>
      )}
      {onboarding && (
        <Onboarding
          lang={lang}
          name={settings.name}
          onName={(name) => update({ name })}
          onLang={() => update({ lang: lang === "en" ? "ne" : "en" })}
          onDone={() => finishOnboarding(false)}
          onPlay={() => finishOnboarding(true)}
        />
      )}
      {settingsOpen && (
        <div className="results sheet-wrap" role="dialog" aria-modal="true" aria-label={t(lang, "settings")} onClick={() => setSettingsOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{t(lang, "settings")}</h2>
            <ul className="settings-list">
              {(
                [
                  ["sound", settings.sound ? "soundOn" : "soundOff"],
                  ["haptics", settings.haptics ? "vibrate" : "vibrateOff"],
                  ["marks", "shapes"],
                  ["largeText", "textSize"],
                ] as const
              ).map(([key, icon]) => (
                <li key={key}>
                  <label className="setting">
                    <Icon name={icon} />
                    <span>{t(lang, key)}</span>
                    <input type="checkbox" role="switch" checked={settings[key]} onChange={() => update({ [key]: !settings[key] })} />
                  </label>
                </li>
              ))}
            </ul>
            <div className="row-btns">
              <button type="button" className="btn" onClick={() => (setSettingsOpen(false), setRules(true))}>
                <Icon name="book" size={18} /> {t(lang, "rules")}
              </button>
              {canInstall && (
                <button type="button" className="btn" onClick={install}>
                  <Icon name="download" size={18} /> {t(lang, "install")}
                </button>
              )}
              <a className="btn ghost" href="https://sabin78910.github.io/privacy-policy/" target="_blank" rel="noreferrer">
                {t(lang, "privacy")}
              </a>
            </div>
            <button type="button" className="btn primary big" onClick={() => setSettingsOpen(false)}>
              {t(lang, "close")}
            </button>
          </div>
        </div>
      )}
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
  master,
  teams,
  settings,
  reduced,
  onGameOver,
  onExit,
  onAgain,
  onVerify,
}: {
  seats: LocalSeat[];
  quick: boolean;
  master: boolean;
  teams: boolean;
  settings: Settings;
  reduced: boolean;
  onGameOver(won: boolean): void;
  onExit(): void;
  onAgain(): void;
  onVerify(p: Proof): void;
}) {
  const ctl = useLocalGame(seats, quick, settings.clientSeed, reduced, master, teams);
  const state = ctl.state!;
  return (
    <GameView
      ctl={ctl}
      names={seats.map((s) => s.name)}
      lang={settings.lang}
      sound={settings.sound}
      haptics={settings.haptics}
      reduced={reduced}
      onGameOver={onGameOver}
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
