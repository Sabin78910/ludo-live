import { ROOM_CODE_ALPHABET, cleanName, newRoomCode, normalizeRoomCode, parseClientMsg } from "./protocol";

describe("room codes", () => {
  it("are 6 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = newRoomCode();
      expect(code).toHaveLength(6);
      for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
    }
  });
  it("skip biased bytes", () => {
    // 256 % 32 == 0, so no byte is rejected; every byte maps to alphabet[b % 32].
    const code = newRoomCode(() => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]));
    expect(code).toBe("ABCDEF");
  });
  it("normalise user input", () => {
    expect(normalizeRoomCode(" ab cd2f ")).toBe("ABCD2F");
    expect(normalizeRoomCode("abc")).toBeNull();
    expect(normalizeRoomCode("ABCDE0")).toBeNull(); // 0 is not in the alphabet
    expect(normalizeRoomCode(null)).toBeNull();
  });
});

describe("cleanName", () => {
  it("strips control characters and angle brackets and trims", () => {
    expect(cleanName("  <b>Sabin</b>  ")).toBe("bSabin/b");
    expect(cleanName("x".repeat(40))).toHaveLength(16);
    expect(cleanName("", "Guest")).toBe("Guest");
  });
});

describe("parseClientMsg", () => {
  it("accepts valid messages", () => {
    expect(parseClientMsg('{"t":"roll"}')).toEqual({ t: "roll" });
    expect(parseClientMsg('{"t":"move","token":2}')).toEqual({ t: "move", token: 2 });
    expect(parseClientMsg('{"t":"emoji","emoji":"🔥"}')).toEqual({ t: "emoji", emoji: "🔥" });
    expect(parseClientMsg('{"t":"start","quick":true}')).toEqual({ t: "start", quick: true });
    expect(parseClientMsg('{"t":"hello","name":"A","clientSeed":"x","create":true}')).toMatchObject({ t: "hello", name: "A", create: true });
  });
  it("rejects malformed or unknown input", () => {
    expect(parseClientMsg("not json")).toBeNull();
    expect(parseClientMsg('{"t":"hack"}')).toBeNull();
    expect(parseClientMsg('{"t":"move","token":"1"}')).toBeNull();
    expect(parseClientMsg('{"t":"emoji","emoji":"<script>"}')).toBeNull();
    expect(parseClientMsg("x".repeat(3000))).toBeNull();
    expect(parseClientMsg(42)).toBeNull();
  });
});

describe("parseClientMsg signal", () => {
  const sig = (o: object) => JSON.stringify({ t: "signal", to: 1, kind: "offer", data: "sdp", ...o });
  it("accepts offer, answer and ice", () => {
    for (const kind of ["offer", "answer", "ice"]) expect(parseClientMsg(sig({ kind }))).toEqual({ t: "signal", to: 1, kind, data: "sdp" });
  });
  it("accepts payloads above the general limit but not above the signal limit", () => {
    expect(parseClientMsg(sig({ data: "x".repeat(5000) }))).not.toBeNull();
    expect(parseClientMsg(sig({ data: "x".repeat(6001) }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: "emoji", emoji: "🔥", pad: "x".repeat(3000) }))).toBeNull();
  });
  it("rejects bad shapes", () => {
    expect(parseClientMsg(sig({ kind: "bye" }))).toBeNull();
    expect(parseClientMsg(sig({ to: "1" }))).toBeNull();
    expect(parseClientMsg(sig({ to: 1.5 }))).toBeNull();
    expect(parseClientMsg(sig({ data: "" }))).toBeNull();
    expect(parseClientMsg(sig({ data: 5 }))).toBeNull();
  });
});
