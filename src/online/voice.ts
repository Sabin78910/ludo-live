// Voice mesh: one audio-only RTCPeerConnection per other player, signalled through the room socket.
// Public STUN only (no TURN). The lower seat number wins if both sides offer at once.
import type { SignalKind } from "../engine/protocol";

export const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export interface PeerLike {
  onicecandidate: ((ev: { candidate: unknown }) => void) | null;
  ontrack: ((ev: { streams: MediaStream[] }) => void) | null;
  addTrack(track: MediaStreamTrack, stream: MediaStream): unknown;
  createOffer(): Promise<unknown>;
  createAnswer(): Promise<unknown>;
  setLocalDescription(d: unknown): Promise<void>;
  setRemoteDescription(d: unknown): Promise<void>;
  addIceCandidate(c: unknown): Promise<void>;
  close(): void;
}

export interface VoiceDeps {
  getMic(): Promise<MediaStream>;
  createPeer(): PeerLike;
  /** Called with each remote stream so the UI can play it. */
  onRemote(seat: number, stream: MediaStream | null): void;
}

export class VoiceMesh {
  private local: MediaStream | null = null;
  private peers = new Map<number, PeerLike>();
  private streams = new Map<number, MediaStream>();
  private muted = new Set<number>();
  private offering = new Set<number>();
  private stopped = false;

  constructor(
    private readonly me: number,
    private readonly send: (to: number, kind: SignalKind, data: string) => void,
    private readonly deps: VoiceDeps,
  ) {}

  get active(): boolean {
    return this.local !== null;
  }

  /** Ask for the microphone (only ever called from a tap) and offer to every listed seat. */
  async start(others: number[]): Promise<void> {
    this.local = await this.deps.getMic();
    if (this.stopped) {
      this.local.getTracks().forEach((t) => t.stop());
      return;
    }
    for (const seat of others) if (seat !== this.me) await this.offer(seat);
  }

  /** Offer to seats we are not yet connected to (players who joined after we turned the mic on). */
  async connectNew(present: number[]): Promise<void> {
    for (const seat of present) if (seat !== this.me && !this.peers.has(seat) && this.local) await this.offer(seat);
  }

  private peer(seat: number): PeerLike {
    let p = this.peers.get(seat);
    if (p) return p;
    p = this.deps.createPeer();
    p.onicecandidate = (ev) => {
      if (ev.candidate) this.send(seat, "ice", JSON.stringify(ev.candidate));
    };
    p.ontrack = (ev) => {
      const s = ev.streams[0];
      if (!s) return;
      this.streams.set(seat, s);
      this.applyMute(seat);
      this.deps.onRemote(seat, s);
    };
    this.local?.getTracks().forEach((t) => p!.addTrack(t, this.local!));
    this.peers.set(seat, p);
    return p;
  }

  private async offer(seat: number): Promise<void> {
    const p = this.peer(seat);
    this.offering.add(seat);
    const d = await p.createOffer();
    await p.setLocalDescription(d);
    this.send(seat, "offer", JSON.stringify(d));
  }

  async handle(from: number, kind: SignalKind, data: string): Promise<void> {
    if (!this.local || this.stopped || from === this.me) return; // voice is off: ignore, never open the mic for others
    let body: unknown;
    try {
      body = JSON.parse(data);
    } catch {
      return;
    }
    if (kind === "offer") {
      if (this.offering.has(from) && this.me < from) return; // glare: our offer wins
      if (this.offering.has(from)) this.drop(from);
      const p = this.peer(from);
      await p.setRemoteDescription(body);
      const a = await p.createAnswer();
      await p.setLocalDescription(a);
      this.send(from, "answer", JSON.stringify(a));
    } else if (kind === "answer") {
      await this.peers.get(from)?.setRemoteDescription(body);
      this.offering.delete(from);
    } else {
      await this.peers.get(from)?.addIceCandidate(body);
    }
  }

  /** Mute or unmute what we hear from one player (local only). */
  setMuted(seat: number, muted: boolean): void {
    if (muted) this.muted.add(seat);
    else this.muted.delete(seat);
    this.applyMute(seat);
  }

  private applyMute(seat: number): void {
    const on = !this.muted.has(seat);
    this.streams.get(seat)?.getAudioTracks().forEach((t) => (t.enabled = on));
  }

  /** Close connections to seats that are no longer present. */
  prune(present: number[]): void {
    for (const seat of [...this.peers.keys()]) if (!present.includes(seat)) this.drop(seat);
  }

  private drop(seat: number): void {
    this.peers.get(seat)?.close();
    this.peers.delete(seat);
    this.streams.delete(seat);
    this.offering.delete(seat);
    this.deps.onRemote(seat, null);
  }

  stop(): void {
    this.stopped = true;
    for (const seat of [...this.peers.keys()]) this.drop(seat);
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
  }
}

export function browserVoiceDeps(onRemote: VoiceDeps["onRemote"]): VoiceDeps {
  return {
    getMic: () => navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
    createPeer: () => new RTCPeerConnection({ iceServers: STUN_SERVERS }) as unknown as PeerLike,
    onRemote,
  };
}
