import { VoiceMesh, type PeerLike } from "./voice";

class FakePeer implements PeerLike {
  onicecandidate: PeerLike["onicecandidate"] = null;
  ontrack: PeerLike["ontrack"] = null;
  closed = false;
  remote: unknown = null;
  ice: unknown[] = [];
  tracks = 0;
  addTrack() {
    this.tracks++;
  }
  async createOffer() {
    return { type: "offer" };
  }
  async createAnswer() {
    return { type: "answer" };
  }
  async setLocalDescription() {}
  async setRemoteDescription(d: unknown) {
    this.remote = d;
  }
  async addIceCandidate(c: unknown) {
    this.ice.push(c);
  }
  close() {
    this.closed = true;
  }
}

function setup(me: number) {
  const peers: FakePeer[] = [];
  const sent: [number, string, string][] = [];
  const remote = vi.fn();
  const track = { stop: vi.fn(), enabled: true };
  const mic = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  const getMic = vi.fn(async () => mic);
  const mesh = new VoiceMesh(me, (to, kind, data) => sent.push([to, kind, data]), {
    getMic,
    createPeer: () => {
      const p = new FakePeer();
      peers.push(p);
      return p;
    },
    onRemote: remote,
  });
  return { mesh, peers, sent, remote, track, getMic };
}

describe("VoiceMesh", () => {
  it("does not touch the microphone until started", () => {
    const { getMic } = setup(0);
    expect(getMic).not.toHaveBeenCalled();
  });
  it("offers to every other seat once started", async () => {
    const { mesh, sent, peers } = setup(1);
    await mesh.start([0, 1, 2]);
    expect(sent.map(([to, kind]) => [to, kind])).toEqual([[0, "offer"], [2, "offer"]]);
    expect(peers.every((p) => p.tracks === 1)).toBe(true);
  });
  it("ignores offers while voice is off", async () => {
    const { mesh, sent, peers } = setup(0);
    await mesh.handle(1, "offer", '{"type":"offer"}');
    expect(sent).toEqual([]);
    expect(peers).toHaveLength(0);
  });
  it("answers an offer and applies ice", async () => {
    const { mesh, sent, peers } = setup(0);
    await mesh.start([]);
    await mesh.handle(1, "offer", '{"type":"offer"}');
    expect(sent[0][0]).toBe(1);
    expect(sent[0][1]).toBe("answer");
    await mesh.handle(1, "ice", '{"candidate":"x"}');
    expect(peers[0].ice).toEqual([{ candidate: "x" }]);
  });
  it("lets the lower seat win when both offer", async () => {
    const low = setup(0);
    await low.mesh.start([1]);
    await low.mesh.handle(1, "offer", '{"type":"offer"}');
    expect(low.sent.map((s) => s[1])).toEqual(["offer"]); // no answer to the higher seat
    const high = setup(1);
    await high.mesh.start([0]);
    await high.mesh.handle(0, "offer", '{"type":"offer"}');
    expect(high.sent.map((s) => s[1])).toEqual(["offer", "answer"]);
  });
  it("ignores garbage payloads", async () => {
    const { mesh, peers } = setup(0);
    await mesh.start([]);
    await mesh.handle(1, "offer", "not json");
    expect(peers).toHaveLength(0);
  });
  it("mutes one player by disabling their incoming tracks", async () => {
    const { mesh, peers } = setup(0);
    await mesh.start([1]);
    const t = { enabled: true };
    peers[0].ontrack?.({ streams: [{ getAudioTracks: () => [t] } as unknown as MediaStream] });
    mesh.setMuted(1, true);
    expect(t.enabled).toBe(false);
    mesh.setMuted(1, false);
    expect(t.enabled).toBe(true);
  });
  it("stop closes peers and releases the microphone", async () => {
    const { mesh, peers, track, remote } = setup(0);
    await mesh.start([1, 2]);
    mesh.stop();
    expect(peers.every((p) => p.closed)).toBe(true);
    expect(track.stop).toHaveBeenCalled();
    expect(remote).toHaveBeenCalledWith(1, null);
    expect(mesh.active).toBe(false);
  });
  it("offers to players who join after the mic is on, once", async () => {
    const { mesh, sent } = setup(0);
    await mesh.start([1]);
    await mesh.connectNew([1, 2]);
    await mesh.connectNew([1, 2]);
    expect(sent.map((x) => x[0])).toEqual([1, 2]);
  });
  it("prune drops seats that left", async () => {
    const { mesh, peers } = setup(0);
    await mesh.start([1, 2]);
    mesh.prune([1]);
    expect(peers.map((p) => p.closed)).toEqual([false, true]);
  });
});
