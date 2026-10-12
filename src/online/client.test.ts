import { RoomClient, backoff, savedToken, type SocketLike } from "./client";

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.readyState = 3;
    this.onclose?.({});
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  recv(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

describe("RoomClient", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  function make(create = true) {
    const sockets: FakeSocket[] = [];
    const onState = vi.fn();
    const onError = vi.fn();
    const c = new RoomClient("ws://x/room/ABCDEF", "ABCDEF", { name: "A", clientSeed: "s1", create }, { onState, onError }, () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    });
    c.connect();
    return { c, sockets, onState, onError };
  }

  it("says hello with create on first connect and stores the rejoin token", () => {
    const { sockets } = make();
    sockets[0].open();
    expect(JSON.parse(sockets[0].sent[0])).toMatchObject({ t: "hello", name: "A", clientSeed: "s1", create: true });
    sockets[0].recv({ t: "welcome", seat: 0, token: "tok123", code: "ABCDEF" });
    expect(savedToken("ABCDEF")).toBe("tok123");
  });

  it("reconnects with the token (and without create) after a drop", () => {
    const { sockets } = make();
    sockets[0].open();
    sockets[0].recv({ t: "welcome", seat: 0, token: "tok9", code: "ABCDEF" });
    sockets[0].close();
    vi.advanceTimersByTime(backoff(0));
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    expect(JSON.parse(sockets[1].sent[0])).toMatchObject({ t: "hello", token: "tok9", create: false });
  });

  it("delivers state and stops retrying after a fatal error", () => {
    const { sockets, onState, onError } = make(false);
    sockets[0].open();
    sockets[0].recv({ t: "state", room: { code: "ABCDEF" } });
    expect(onState).toHaveBeenCalledTimes(1);
    sockets[0].recv({ t: "error", code: "not_found", message: "Room not found" });
    expect(onError).toHaveBeenCalledWith("not_found", "Room not found");
    vi.advanceTimersByTime(20_000);
    expect(sockets).toHaveLength(1);
  });

  it("delivers quick chat to the handler", () => {
    const sockets: FakeSocket[] = [];
    const onChat = vi.fn();
    const c = new RoomClient("ws://x/room/ABCDEF", "ABCDEF", { name: "A", clientSeed: "s1", create: true }, { onState: vi.fn(), onChat }, () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    });
    c.connect();
    sockets[0].open();
    sockets[0].recv({ t: "chat", playerId: 1, phraseId: "wow" });
    expect(onChat).toHaveBeenCalledWith(1, "wow");
  });

  it("ignores garbage messages", () => {
    const { sockets, onState } = make();
    sockets[0].open();
    sockets[0].onmessage?.({ data: "not json" });
    sockets[0].onmessage?.({ data: 42 });
    expect(onState).not.toHaveBeenCalled();
  });

  it("backs off exponentially up to 8s", () => {
    expect([0, 1, 2, 3, 4, 10].map(backoff)).toEqual([500, 1000, 2000, 4000, 8000, 8000]);
  });
});
