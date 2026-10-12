import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomView, SignalKind } from "../engine/protocol";
import { t, type Lang } from "../game/i18n";
import type { OnlineRoom } from "../online/useOnlineRoom";
import { VoiceMesh, browserVoiceDeps } from "../online/voice";

export interface VoiceState {
  on: boolean;
  failed: boolean;
  muted: number[];
  streams: Record<number, MediaStream>;
  toggle(): void;
  toggleMute(seat: number): void;
}

/** Owns the voice mesh for the room. The mic is requested only from toggle(), and released on leave. */
export function useVoice(room: RoomView | null, send: OnlineRoom["send"], onSignal: OnlineRoom["onSignal"]): VoiceState {
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState<number[]>([]);
  const [streams, setStreams] = useState<Record<number, MediaStream>>({});
  const mesh = useRef<VoiceMesh | null>(null);
  const you = room?.you ?? null;
  // Humans other than me, as a stable string so effects don't re-run on every state tick.
  const peers = room ? room.seats.flatMap((s, i) => (i !== you && s.connected && !s.bot ? [i] : [])) : [];
  const peerKey = peers.join(",");

  const stop = useCallback(() => {
    mesh.current?.stop();
    mesh.current = null;
    setStreams({});
    setOn(false);
  }, []);

  const toggle = () => {
    if (mesh.current || you === null) return stop();
    const m = new VoiceMesh(you, (to, kind, data) => send({ t: "signal", to, kind, data }), browserVoiceDeps((seat, stream) =>
      setStreams((s) => {
        const next = { ...s };
        if (stream) next[seat] = stream;
        else delete next[seat];
        return next;
      }),
    ));
    mesh.current = m;
    setFailed(false);
    m.start(peers).then(
      () => setOn(true),
      () => {
        if (mesh.current === m) mesh.current = null;
        setFailed(true);
      },
    );
  };

  useEffect(() => {
    onSignal((from: number, kind: SignalKind, data: string) => void mesh.current?.handle(from, kind, data).catch(() => undefined));
    return () => onSignal(null);
  }, [onSignal]);

  // New players joining after we started get an offer; players who left are closed.
  useEffect(() => {
    const m = mesh.current;
    if (!m?.active) return;
    const present = peerKey ? peerKey.split(",").map(Number) : [];
    m.prune(present);
    m.connectNew(present);
  }, [peerKey, on]);

  useEffect(() => () => mesh.current?.stop(), []); // leaving the room ends voice

  const toggleMute = (seat: number) => {
    const next = muted.includes(seat) ? muted.filter((x) => x !== seat) : [...muted, seat];
    mesh.current?.setMuted(seat, next.includes(seat));
    setMuted(next);
  };

  return { on, failed, muted, streams, toggle, toggleMute };
}

function Audio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

export function VoiceControls({ lang, room, voice }: { lang: Lang; room: RoomView | null; voice: VoiceState }) {
  if (!room || room.you === null || typeof RTCPeerConnection === "undefined") return null;
  return (
    <div className="voice">
      <button type="button" className={`btn small${voice.on ? " primary" : ""}`} aria-pressed={voice.on} onClick={voice.toggle}>
        {voice.on ? `🎙️ ${t(lang, "voiceOn")}` : `🔇 ${t(lang, "voiceOff")}`}
      </button>
      {voice.failed && <span className="muted small">{t(lang, "voiceDenied")}</span>}
      {voice.on &&
        room.seats.map((s, i) =>
          i === room.you || s.bot || !voice.streams[i] ? null : (
            <button
              key={i}
              type="button"
              className="btn small ghost"
              aria-pressed={voice.muted.includes(i)}
              onClick={() => voice.toggleMute(i)}
            >
              {voice.muted.includes(i) ? "🔇" : "🔊"} {t(lang, voice.muted.includes(i) ? "voiceUnmute" : "voiceMute", { name: s.name })}
            </button>
          ),
        )}
      {Object.entries(voice.streams).map(([seat, stream]) => (
        <Audio key={seat} stream={stream} />
      ))}
    </div>
  );
}
