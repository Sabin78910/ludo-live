import { useEffect, useState } from "react";
import { t, type Lang } from "../game/i18n";
import { inviteLink, whatsappUrl } from "../game/share";
import { useOnlineRoom } from "../online/useOnlineRoom";
import { GameView } from "./GameView";
import type { Proof } from "./Verify";

export interface OnlineProps {
  url: string;
  code: string;
  create: boolean;
  name: string;
  clientSeed: string;
  lang: Lang;
  sound: boolean;
  haptics: boolean;
  reduced: boolean;
  quick: boolean;
  /** Called once per game with the other human players' names. */
  onPlayed?(names: string[]): void;
  onExit(): void;
  onVerify(p: Proof): void;
}

export function OnlineRoomScreen(p: OnlineProps) {
  const { room, status, error, reactions, send, controller } = useOnlineRoom(p.url, p.code, p.name, p.clientSeed, p.create, p.reduced);
  const [quick, setQuick] = useState(p.quick);
  const [copied, setCopied] = useState(false);
  const lang = p.lang;
  const started = !!room?.game;
  const { onPlayed } = p;
  useEffect(() => {
    if (!room?.game || room.you === null) return;
    const others = room.seats.filter((s, i) => i !== room.you && !s.bot).map((s) => s.name);
    if (others.length) onPlayed?.(others);
    // Save once when the game starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);
  const link = inviteLink(p.code, window.location);
  const shareText = `${t(lang, "shareText", { code: p.code })} ${link}`;

  if (error && (error.code === "not_found" || error.code === "full" || error.code === "started" || error.code === "exists") && !room) {
    return (
      <main className="screen center">
        <p className="verdict bad">{error.code === "not_found" ? t(lang, "roomNotFound") : error.message}</p>
        <button type="button" className="btn" onClick={p.onExit}>
          {t(lang, "back")}
        </button>
      </main>
    );
  }

  const banner = status === "reconnecting" ? t(lang, "reconnecting") : status === "connecting" && room ? t(lang, "connecting") : null;

  if (room && room.game && controller) {
    const names = room.game.players.map((pl, i) => (room.playerSeats[i] === room.you ? `${pl.name} (${t(lang, "you")})` : pl.name));
    return (
      <GameView
        ctl={controller}
        names={names}
        lang={lang}
        sound={p.sound}
        haptics={p.haptics}
        reduced={p.reduced}
        onExit={p.onExit}
        onVerify={() =>
          room.serverSeed &&
          p.onVerify({
            serverSeed: room.serverSeed,
            serverSeedHash: room.serverSeedHash,
            clientSeeds: room.clientSeeds,
            rolls: room.game!.rolls,
            names: room.game!.players.map((x) => x.name),
          })
        }
        reactions={reactions}
        playerOfSeat={(seat) => room.playerSeats.indexOf(seat)}
        onEmoji={(emoji) => send({ t: "emoji", emoji })}
        banner={banner}
      />
    );
  }

  const isHost = room !== null && room.you !== null && room.seats[room.you]?.host;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the link is visible to copy by hand.
    }
  };
  const nativeShare = () => {
    void navigator.share?.({ title: t(lang, "appName"), text: t(lang, "shareText", { code: p.code }), url: link }).catch(() => undefined);
  };

  return (
    <main className="screen lobby">
      <button type="button" className="btn ghost back" onClick={p.onExit}>
        ← {t(lang, "leave")}
      </button>
      <p className="eyebrow">{t(lang, "roomCode")}</p>
      <h1 className="room-code" aria-label={`${t(lang, "roomCode")} ${p.code.split("").join(" ")}`}>
        {p.code}
      </h1>
      {!room && <p className="muted">{t(lang, "connecting")}</p>}
      {banner && <p className="banner">{banner}</p>}
      <section className="glass invite">
        <h2>{t(lang, "inviteFriends")}</h2>
        <code className="link">{link}</code>
        <div className="row-btns">
          <a className="btn whatsapp" href={whatsappUrl(shareText)} target="_blank" rel="noreferrer">
            {t(lang, "whatsapp")}
          </a>
          <button type="button" className="btn" onClick={copy}>
            {copied ? t(lang, "copied") : t(lang, "copyLink")}
          </button>
          {"share" in navigator && (
            <button type="button" className="btn" onClick={nativeShare}>
              {t(lang, "share")}
            </button>
          )}
        </div>
      </section>
      {room && (
        <section className="glass seats">
          <h2>
            {t(lang, "players")} {room.seats.length}/4
          </h2>
          <ul>
            {room.seats.map((s, i) => (
              <li key={i} className={s.connected ? "" : "dim"}>
                <span className="avatar">{s.bot ? "🤖" : s.name.slice(0, 1).toUpperCase()}</span>
                <span className="pname">
                  {s.name}
                  {i === room.you && ` (${t(lang, "you")})`}
                </span>
                {s.host && <span className="tag gold">{t(lang, "host")}</span>}
                {!s.connected && <span className="tag warn">{t(lang, "offline")}</span>}
                {isHost && s.bot && (
                  <button type="button" className="btn small ghost" onClick={() => send({ t: "removeBot", seat: i })}>
                    {t(lang, "remove")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isHost ? (
            <>
              {room.seats.length < 4 && (
                <button type="button" className="btn" onClick={() => send({ t: "addBot" })}>
                  + {t(lang, "addBot")}
                </button>
              )}
              <label className="switch">
                <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
                <span>
                  ⚡ {t(lang, "quickMode")} <small>{t(lang, "quickModeSub")}</small>
                </span>
              </label>
              <button type="button" className="btn primary big" disabled={room.seats.length < 2} onClick={() => send({ t: "start", quick })}>
                {room.seats.length < 2 ? t(lang, "needTwo") : t(lang, "start")}
              </button>
            </>
          ) : (
            <p className="muted">{room.seats.length < 2 ? t(lang, "waitingPlayers") : t(lang, "waitingHost")}</p>
          )}
          {error && <p className="verdict bad">{error.message}</p>}
          <p className="muted small">
            🔒 {t(lang, "fairChip")}: <code>{room.serverSeedHash.slice(0, 16)}…</code>
          </p>
        </section>
      )}
    </main>
  );
}
