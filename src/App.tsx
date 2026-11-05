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
import { chestReady, DICE_SKINS, earnForGame, loadRewards, openChest, saveRewards, SKIN_COST, unlockSkin, type DiceSkin, type Rewards } from "./game/rewards";
import chestArt from "./assets/chest.webp";
import { loadRating, pickDifficulty, saveRating, updateRating } from "./game/skill";
import { needsOnboarding } from "./game/onboarding";
import { GameView } from "./ui/GameView";
import { Onboarding } from "./ui/Onboarding";
import { Icon } from "./ui/Icon";
import { OnlineRoomScreen } from "./ui/Online";
import { SnakesGame, type SnakesSeat } from "./ui/SnakesGame";
import { Verify, type Proof } from "./ui/Verify";

const WS_URL = import.meta.env.VITE_WS_URL;

type Screen =
  | { name: "home" }
  | { name: "setup"; mode: "bots" | "local" }
  | { name: "local"; seats: LocalSeat[]; quick: boolean; master: boolean; teams: boolean; six?: boolean; key: number }
  | { name: "snakesSetup" }
  | { name: "snakes"; seats: SnakesSeat[]; key: number }
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
  const [slBots, setSlBots] = useState(true);
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
  const [rating, setRating] = useState(loadRating);
  const [rewards, setRewardsState] = useState(loadRewards);
  const [chest, setChest] = useState<null | { amount: number | null }>(null);
  const setRewards = (fn: (r: Rewards) => Rewards) =>
    setRewardsState((r) => {
      const next = fn(r);
      saveRewards(next);
      return next;
    });
  const today = dayKey(new Date());
  const pickSkin = (d: DiceSkin) => {
    if (rewards.owned.includes(d)) return update({ dice: d });
    const next = unlockSkin(rewards, d);
    if (next) {
      setRewards(() => next);
      update({ dice: d });
    }
  };
  const botLevel = (s: Settings): Difficulty => (s.autoLevel ? pickDifficulty(rating) : s.difficulty);
  const onGameOver = (won: boolean, seats?: LocalSeat[]) => {
    const bots = seats?.filter((x) => x.bot) ?? [];
    if (bots.length && bots[0].bot)
      setRating((r) => {
        const next = updateRating(r, bots[0].bot!, won, bots.length);
        saveRating(next);
        return next;
      });
    setRewards((r) => earnForGame(r, won));
    setStats((s) => {
      const next = recordGame(s, won, dayKey(new Date()));
      saveStats(next);
      return next;
    });
  };
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
    root.dataset.dice = settings.dice;
  }, [settings.marks, settings.largeText, settings.board, settings.dice]);

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
        six={screen.six === true}
        settings={settings}
        reduced={reduced}
        onGameOver={(won) => onGameOver(won, screen.seats)}
        wins={stats.won}
        onExit={() => setScreen({ name: "home" })}
        onAgain={() => setScreen({ ...screen, key: screen.key + 1 })}
        onVerify={(proof) => setScreen({ name: "verify", proof, back: { name: "home" } })}
      />
    );
  }

  if (screen.name === "snakes") {
    return (
      <SnakesGame
        key={screen.key}
        seats={screen.seats}
        clientSeed={settings.clientSeed}
        lang={lang}
        sound={settings.sound}
        haptics={settings.haptics}
        reduced={reduced}
        onGameOver={onGameOver}
        wins={stats.won}
        onExit={() => setScreen({ name: "home" })}
        onAgain={() => setScreen({ ...screen, key: screen.key + 1 })}
        onVerify={(proof) => setScreen({ name: "verify", proof, back: { name: "home" } })}
      />
    );
  }

  if (screen.name === "snakesSetup") {
    const start = () => {
      tap();
      const seats: SnakesSeat[] = seatColors(Math.min(settings.players, 4)).map((color, i) => ({
        color,
        name: i === 0 ? myName : slBots ? `${t(lang, "computer")} ${i}` : `${t(lang, "player")} ${i + 1}`,
        bot: slBots && i > 0,
      }));
      setScreen({ name: "snakes", seats, key: Date.now() });
    };
    return (
      <main className="screen setup">
        <button type="button" className="btn ghost back" onClick={() => setScreen({ name: "home" })}>
          <Icon name="back" size={18} /> {t(lang, "back")}
        </button>
        <h1>{t(lang, "snakes")}</h1>
        <section className="glass form">
          <label className="field">
            <span>{t(lang, "yourName")}</span>
            <input value={settings.name} maxLength={16} onChange={(e) => update({ name: e.target.value })} placeholder={t(lang, "you")} />
          </label>
          <fieldset className="seg">
            <legend>{t(lang, "opponents")}</legend>
            <button type="button" aria-pressed={slBots} onClick={() => setSlBots(true)}>
              {t(lang, "computer")}
            </button>
            <button type="button" aria-pressed={!slBots} onClick={() => setSlBots(false)}>
              {t(lang, "friends")}
            </button>
          </fieldset>
          <fieldset className="seg">
            <legend>{t(lang, "players")}</legend>
            {[2, 3, 4].map((n) => (
              <button key={n} type="button" aria-pressed={settings.players === n} onClick={() => update({ players: n })}>
                {n}
              </button>
            ))}
          </fieldset>
          <p className="muted small">{t(lang, "exactFinish")}</p>
          <button type="button" className="btn primary big" onClick={start}>
            {t(lang, "start")}
          </button>
        </section>
      </main>
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
      const colors = seatColors(settings.players, settings.six);
      const seats: LocalSeat[] = colors.map((color, i) => ({
        color,
        name: bots ? (i === 0 ? myName : `${t(lang, "bot")} ${i}`) : i === 0 && settings.name ? settings.name : `${t(lang, "player")} ${i + 1}`,
        bot: bots && i > 0 ? botLevel(settings) : null,
      }));
      setScreen({ name: "local", seats, quick: settings.quick, master: settings.master, teams: !settings.six && settings.teams && settings.players === 4, six: settings.six, key: Date.now() });
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
            <legend>{t(lang, "boardSize")}</legend>
            <button type="button" aria-pressed={!settings.six} onClick={() => update({ six: false, players: Math.min(settings.players, 4) })}>
              {t(lang, "board4")}
            </button>
            <button type="button" aria-pressed={settings.six} onClick={() => update({ six: true, players: 6 })}>
              {t(lang, "board6")}
            </button>
          </fieldset>
          <fieldset className="seg">
            <legend>{t(lang, "players")}</legend>
            {(settings.six ? [2, 3, 4, 5, 6] : [2, 3, 4]).map((n) => (
              <button key={n} type="button" aria-pressed={settings.players === n} onClick={() => update({ players: n })}>
                {n}
              </button>
            ))}
          </fieldset>
          {bots && (
            <fieldset className="seg">
              <legend>{t(lang, "difficulty")}</legend>
              {DIFFICULTIES.map((d: Difficulty) => (
                <button key={d} type="button" aria-pressed={!settings.autoLevel && settings.difficulty === d} onClick={() => update({ difficulty: d, autoLevel: false })}>
                  {t(lang, d as StringKey)}
                </button>
              ))}
              <button type="button" aria-pressed={settings.autoLevel} onClick={() => update({ autoLevel: true })}>
                {t(lang, "auto")}
              </button>
              <small className="seg-note">
                {settings.autoLevel
                  ? t(lang, "autoSub", { level: t(lang, pickDifficulty(rating)) })
                  : t(lang, `${settings.difficulty}Sub`)}
              </small>
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
          {settings.players === 4 && !settings.six && (
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
          <fieldset className="seg boards">
            <legend>
              {t(lang, "diceSkin")}{" "}
              <small className="spark-count">
                <Icon name="spark" size={14} /> {t(lang, "sparks", { n: rewards.sparks })}
              </small>
            </legend>
            {DICE_SKINS.map((d) => {
              const owned = rewards.owned.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={settings.dice === d}
                  disabled={!owned && rewards.sparks < SKIN_COST[d]}
                  onClick={() => pickSkin(d)}
                  title={owned ? undefined : t(lang, "skinCost", { n: SKIN_COST[d] })}
                >
                  <span className={`swatch skin-${d}`} aria-hidden="true" />
                  {t(lang, `skin_${d}`)}
                  {!owned && (
                    <small className="skin-cost">
                      <Icon name="spark" size={12} /> {SKIN_COST[d]}
                    </small>
                  )}
                </button>
              );
            })}
          </fieldset>
          <button type="button" className="btn primary big" onClick={start}>
            {t(lang, "start")}
          </button>
        </section>
      </main>
    );
  }

  const startBots = (s: Settings) => {
    const colors = seatColors(s.players, s.six);
    const seats: LocalSeat[] = colors.map((color, i) => ({
      color,
      name: i === 0 ? s.name.trim() || t(s.lang, "you") : `${t(s.lang, "bot")} ${i}`,
      bot: i > 0 ? botLevel(s) : null,
    }));
    setScreen({ name: "local", seats, quick: s.quick, master: s.master, teams: !s.six && s.teams && s.players === 4, six: s.six, key: Date.now() });
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
        <button
          type="button"
          className={`chip-btn chest-btn${chestReady(rewards, today) ? " ready" : ""}`}
          onClick={() => setChest({ amount: null })}
          aria-label={t(lang, "chestReady")}
        >
          <Icon name={chestReady(rewards, today) ? "gift" : "spark"} size={16} /> {rewards.sparks}
        </button>
        <button type="button" className="chip-btn" onClick={() => update({ lang: lang === "en" ? "ne" : "en" })}>
          {t(lang, "language")}
        </button>
        <button type="button" className="icon-btn" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)} aria-label={t(lang, "settings")}>
          <Icon name="gear" />
        </button>
      </header>

      <section className="hero-card">
        <h1>{t(lang, "appName")}</h1>
        {liveStreak(stats, dayKey(new Date())) > 0 && (
          <p className="hero-sub">
            <span className="streak"><Icon name="bolt" size={16} /> {t(lang, "streakLine", { n: liveStreak(stats, dayKey(new Date())) })}</span>
          </p>
        )}
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
        <button type="button" className="tile tile-wide tl-gold snakes-tile" onClick={() => (tap(), setScreen({ name: "snakesSetup" }))}>
          <span className="tile-icon"><Icon name="ladder" size={30} /></span>
          <strong>{t(lang, "snakes")}</strong>
          <small>{t(lang, "snakesSub")}</small>
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
      {chest && (
        <div className="results" role="dialog" aria-modal="true" aria-label={t(lang, "chestTitle")} onClick={() => setChest(null)}>
          <div className="results-card chest-card" onClick={(e) => e.stopPropagation()}>
            <h2>{t(lang, "chestTitle")}</h2>
            <img className={`chest-art${chest.amount !== null ? " opened" : ""}`} src={chestArt} alt="" width={150} height={150} />
            {chest.amount !== null ? (
              <p className="chest-got" role="status">
                {t(lang, "chestGot", { n: chest.amount })}
              </p>
            ) : !chestReady(rewards, today) ? (
              <p className="muted">{t(lang, "chestDone")}</p>
            ) : null}
            <p className="muted">{t(lang, "chestNote")}</p>
            {chest.amount === null && chestReady(rewards, today) ? (
              <button
                type="button"
                className="btn primary big"
                onClick={() => {
                  const res = openChest(rewards, today);
                  if (!res) return;
                  tap();
                  setRewards(() => res.rewards);
                  setChest({ amount: res.amount });
                }}
              >
                {t(lang, "chestOpen")}
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={() => setChest(null)}>
                {t(lang, "close")}
              </button>
            )}
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
  six,
  settings,
  reduced,
  onGameOver,
  wins,
  onExit,
  onAgain,
  onVerify,
}: {
  seats: LocalSeat[];
  quick: boolean;
  master: boolean;
  teams: boolean;
  six: boolean;
  settings: Settings;
  reduced: boolean;
  onGameOver(won: boolean): void;
  wins: number;
  onExit(): void;
  onAgain(): void;
  onVerify(p: Proof): void;
}) {
  const ctl = useLocalGame(seats, quick, settings.clientSeed, reduced, master, teams, six);
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
      wins={wins}
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
