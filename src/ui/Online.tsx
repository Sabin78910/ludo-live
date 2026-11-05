import { useEffect, useMemo, useRef, useState } from "react";
import { t, type Lang } from "../game/i18n";
import { QUIET_ZONE, qrPath } from "../game/qr";
import { inviteLink, whatsappUrl } from "../game/share";
import { useOnlineRoom } from "../online/useOnlineRoom";
import { GameView } from "./GameView";
import type { Proof } from "./Verify";
import { Icon } from "./Icon";
import { useOnline } from "../game/network";

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
  master: boolean;
  teams: boolean;
  onExit(): void;
  onVerify(p: Proof): void;
  /** Called once when the game starts, with the other human players' names. */
  onPlayers?(names: string[]): void;
}

export function OnlineRoomScreen(p: OnlineProps) {
  const { room, status, error, reactions, send, controller } = useOnlineRoom(p.url, p.code, p.name, p.clientSeed, p.create, p.reduced);
  const [quick, setQuick] = useState(p.quick);
  const [master, setMaster] = useState(p.master);
  const [teams, setTeams] = useState(p.teams);
  const [copied, setCopied] = useState(false);
  const online = useOnline();
  const reported = useRef(false);
  const started = room?.game != null;
  useEffect(() => {
    if (!started || !room || reported.current) return;
    reported.current = true;
    p.onPlayers?.(room.seats.filter((s, i) => !s.bot && i !== room.you).map((s) => s.name));
  }, [started, room, p]);
  const lang = p.lang;
  const link = inviteLink(p.code, window.location);
  const shareText = `${t(lang, "shareText", { code: p.code })} ${link}`;
  const qr = useMemo(() => qrPath(link), [link]);
  const [showQr, setShowQr] = useState(false);

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

  const banner = !online && status !== "open" ? t(lang, "offlineRoom") : status === "reconnecting" ? t(lang, "reconnecting") : status === "connecting" && room ? t(lang, "connecting") : null;

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
        <Icon name="back" size={18} /> {t(lang, "leave")}
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
          <button type="button" className="btn" aria-expanded={showQr} onClick={() => setShowQr((v) => !v)}>
            {t(lang, "showQr")}
          </button>
          {"share" in navigator && (
            <button type="button" className="btn" onClick={nativeShare}>
              {t(lang, "share")}
            </button>
          )}
        </div>
        {showQr && (
          <figure className="qr">
            <svg viewBox={`0 0 ${qr.size + QUIET_ZONE * 2} ${qr.size + QUIET_ZONE * 2}`} role="img" aria-label={t(lang, "qrLabel", { code: p.code })} shapeRendering="crispEdges">
              <rect width="100%" height="100%" fill="#fff" />
              <path d={qr.d} fill="#0b1026" />
            </svg>
            <figcaption className="muted">{t(lang, "qrHint")}</figcaption>
          </figure>
        )}
      </section>
      {room && (
        <section className="glass seats">
          <h2>
            {t(lang, "players")} {room.seats.length}/4
          </h2>
          <ul>
            {room.seats.map((s, i) => (
              <li key={i} className={s.connected ? "" : "dim"}>
                <span className="avatar">{s.bot ? <Icon name="bot" size={18} /> : s.name.slice(0, 1).toUpperCase()}</span>
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
                  <Icon name="bolt" /> {t(lang, "quickMode")} <small>{t(lang, "quickModeSub")}</small>
                </span>
              </label>
              <label className="switch">
                <input type="checkbox" checked={master} onChange={(e) => setMaster(e.target.checked)} />
                <span>
                  <Icon name="target" /> {t(lang, "masterRule")} <small>{t(lang, "masterRuleSub")}</small>
                </span>
              </label>
              {room.seats.length === 4 && (
                <label className="switch">
                  <input type="checkbox" checked={teams} onChange={(e) => setTeams(e.target.checked)} />
                  <span>
                    <Icon name="team" /> {t(lang, "teamsMode")} <small>{t(lang, "teamsModeSub")}</small>
                  </span>
                </label>
              )}
              <button type="button" className="btn primary big" disabled={room.seats.length < 2} onClick={() => send({ t: "start", quick, master, teams: teams && room.seats.length === 4 })}>
                {room.seats.length < 2 ? t(lang, "needTwo") : t(lang, "start")}
              </button>
            </>
          ) : (
            <p className="muted">{room.seats.length < 2 ? t(lang, "waitingPlayers") : t(lang, "waitingHost")}</p>
          )}
          {error && <p className="verdict bad">{error.message}</p>}
          <p className="muted small">
            <Icon name="shield" size={16} /> {t(lang, "fairChip")}: <code>{room.serverSeedHash.slice(0, 16)}…</code>
          </p>
        </section>
      )}
    </main>
  );
}
