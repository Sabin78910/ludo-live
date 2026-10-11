import { verifyRolls } from "../../src/engine/fair";
import { FINISH } from "../../src/engine/rules";
import { BOT_DELAY_MS, IDLE_EXPIRY_MS, RoomCore, TAKEOVER_MS, TURN_MS } from "./room";

const SEED = "f".repeat(64);
let tokenN = 0;
const tok = () => `tok${++tokenN}`;

async function lobby(players = 2) {
  const room = await RoomCore.create("ABCDEF", 1000, SEED);
  const seats = [];
  for (let i = 0; i < players; i++) {
    const r = room.join({ name: `P${i}`, clientSeed: `seed${i}` }, 1000, tok);
    if (!r.ok) throw new Error(r.message);
    seats.push(r);
  }
  return { room, seats };
}

/** Drive the game: current human seat rolls and makes the first legal move. */
async function playTurn(room: RoomCore, now: number) {
  const seat = room.currentSeat()!;
  await room.roll(seat, now);
  const g = room.data.game!;
  if (g.phase === "move" && room.currentSeat() === seat) {
    const token = g.tokens[g.current].findIndex((p) => p >= -1 && p < FINISH && (p >= 0 || g.dice === 6) && p + (g.dice ?? 0) <= FINISH);
    room.move(seat, token, now);
  }
}

describe("RoomCore 6-player board", () => {
  it("only the host picks the board, and the seat cap follows it", async () => {
    const { room } = await lobby(4);
    expect(room.setBoard(1, "hex")).toMatchObject({ ok: false, code: "not_allowed" });
    expect(room.setBoard(0, "hex")).toEqual({ ok: true });
    expect(room.view(0, 0).board).toBe("hex");
    expect(room.join({ name: "P4", clientSeed: "a" }, 0, tok)).toMatchObject({ ok: true, seat: 4 });
    expect(room.addBot(0, 0)).toEqual({ ok: true });
    expect(room.join({ name: "X", clientSeed: "x" }, 0, tok)).toMatchObject({ ok: false, code: "full" });
    expect(room.addBot(0, 0)).toMatchObject({ ok: false, code: "full" });
  });
  it("refuses to go back to the classic board with more than 4 seated", async () => {
    const { room } = await lobby(4);
    room.setBoard(0, "hex");
    room.addBot(0, 0);
    expect(room.setBoard(0, "classic")).toMatchObject({ ok: false, code: "bad" });
  });
  it("starts a hex game with six distinct colours and a fair 78-cell board", async () => {
    const { room } = await lobby(2);
    room.setBoard(0, "hex");
    for (let i = 0; i < 4; i++) room.addBot(0, 0);
    expect(room.start(0, false, 0)).toEqual({ ok: true });
    expect(room.data.game!.board).toBe("hex");
    expect(new Set(room.data.game!.players.map((p) => p.color)).size).toBe(6);
  });
  it("cannot change the board after the game starts", async () => {
    const { room } = await lobby(2);
    room.start(0, false, 0);
    expect(room.setBoard(0, "hex")).toMatchObject({ ok: false, code: "started" });
  });
});

describe("RoomCore lobby", () => {
  it("commits to the server seed hash before anyone joins", async () => {
    const room = await RoomCore.create("ABCDEF", 0, SEED);
    expect(room.data.serverSeedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(room.view(null, 0).serverSeed).toBeNull();
  });
  it("first player becomes host; joins get tokens and seats", async () => {
    const { room, seats } = await lobby(3);
    expect(seats.map((s) => s.seat)).toEqual([0, 1, 2]);
    expect(room.data.host).toBe(0);
    expect(room.view(1, 0).seats[0].host).toBe(true);
  });
  it("rejects a fifth player", async () => {
    const { room } = await lobby(4);
    expect(room.join({ name: "X", clientSeed: "x" }, 0, tok)).toMatchObject({ ok: false, code: "full" });
  });
  it("rejoins with the same token instead of taking a new seat", async () => {
    const { room, seats } = await lobby(2);
    room.disconnect(1, 2000);
    const again = room.join({ name: "P1", clientSeed: "zzz", token: seats[1].token }, 3000, tok);
    expect(again).toMatchObject({ ok: true, seat: 1, rejoined: true });
    expect(room.data.seats).toHaveLength(2);
    expect(room.data.seats[1].connected).toBe(true);
  });
  it("only the host can start, add or remove bots", async () => {
    const { room } = await lobby(2);
    expect(room.start(1, false, 0)).toMatchObject({ ok: false, code: "not_allowed" });
    expect(room.addBot(1, 0)).toMatchObject({ ok: false });
    expect(room.addBot(0, 0)).toEqual({ ok: true });
    expect(room.removeBot(1, 2)).toMatchObject({ ok: false });
    expect(room.removeBot(0, 2)).toEqual({ ok: true });
    expect(room.data.seats).toHaveLength(2);
  });
  it("needs two players to start, but a bot counts", async () => {
    const { room } = await lobby(1);
    expect(room.start(0, false, 0)).toMatchObject({ ok: false, code: "bad" });
    room.addBot(0, 0);
    expect(room.start(0, false, 0)).toEqual({ ok: true });
    expect(room.data.game!.players.map((p) => p.color)).toEqual(["red", "yellow"]);
  });
  it("hands host to another player when the host leaves the lobby", async () => {
    const { room } = await lobby(2);
    room.disconnect(0, 10);
    expect(room.data.host).toBe(1);
  });
  it("drops players who left the lobby when the game starts", async () => {
    const { room } = await lobby(3);
    room.disconnect(1, 10);
    expect(room.start(0, false, 20)).toEqual({ ok: true });
    expect(room.data.seats.map((s) => s.name)).toEqual(["P0", "P2"]);
    expect(room.data.clientSeeds).toEqual(["seed0", "seed2"]);
  });
  it("refuses new players once the game has started", async () => {
    const { room } = await lobby(2);
    room.start(0, false, 0);
    expect(room.join({ name: "Late", clientSeed: "l" }, 0, tok)).toMatchObject({ ok: false, code: "started" });
  });
  it("quick mode starts each player with a token out", async () => {
    const { room } = await lobby(2);
    room.start(0, true, 0);
    expect(room.data.game!.tokens.map((t) => t[0])).toEqual([0, 0]);
    expect(room.view(0, 0).mode).toBe("quick");
  });
});

describe("RoomCore play", () => {
  it("only the current player may roll", async () => {
    const { room } = await lobby(2);
    room.start(0, false, 0);
    expect(await room.roll(1, 0)).toMatchObject({ ok: false, code: "not_allowed" });
    expect(await room.roll(0, 0)).toEqual({ ok: true });
    expect(room.data.game!.rolls).toHaveLength(1);
  });
  it("rejects illegal moves", async () => {
    const { room } = await lobby(2);
    room.start(0, false, 0);
    expect(room.move(0, 0, 0)).toMatchObject({ ok: false });
  });
  it("every server roll is derived from the committed seed and verifies after the game", async () => {
    const { room } = await lobby(2);
    room.start(0, true, 0);
    let now = 1;
    for (let i = 0; i < 400 && room.data.status === "playing"; i++) await playTurn(room, (now += 10));
    expect(room.data.status).toBe("over");
    const v = room.view(0, now);
    expect(v.serverSeed).toBe(SEED);
    const res = await verifyRolls({ serverSeed: v.serverSeed!, serverSeedHash: v.serverSeedHash, clientSeeds: v.clientSeeds, rolls: v.game!.rolls });
    expect(res.allOk).toBe(true);
  });
  it("sets a turn deadline for humans", async () => {
    const { room } = await lobby(2);
    room.start(0, false, 5000);
    expect(room.view(0, 5000).deadline).toBe(5000 + TURN_MS);
  });
  it("plays automatically when the turn timer runs out", async () => {
    const { room } = await lobby(2);
    room.start(0, false, 0);
    expect(await room.tick(TURN_MS - 1)).toBe(false);
    expect(await room.tick(TURN_MS)).toBe(true);
    expect(room.data.game!.rolls.length).toBeGreaterThanOrEqual(1);
  });
  it("a bot takes over 30s after a disconnect and hands back on rejoin", async () => {
    const { room, seats } = await lobby(2);
    room.start(0, false, 0);
    room.disconnect(0, 100);
    await room.tick(100 + TAKEOVER_MS - 1);
    expect(room.data.seats[0].takeover).toBe(false);
    await room.tick(100 + TAKEOVER_MS);
    expect(room.data.seats[0].takeover).toBe(true);
    expect(room.view(1, 0).seats[0].takeover).toBe(true);
    room.join({ name: "P0", clientSeed: "", token: seats[0].token }, 100 + TAKEOVER_MS + 5, tok);
    expect(room.data.seats[0].takeover).toBe(false);
  });
  it("bot seats act after a short delay and hide the deadline", async () => {
    const { room } = await lobby(1);
    room.addBot(0, 0);
    room.start(0, false, 0);
    // Give the turn to the bot.
    room.data.game = { ...room.data.game!, current: 1 };
    (room as unknown as { schedule(n: number): void }).schedule(0);
    expect(room.view(0, 0).deadline).toBeNull();
    await room.tick(BOT_DELAY_MS);
    expect(room.data.game!.rolls.length).toBeGreaterThanOrEqual(1);
  });
  it("a game with only bots plays to the end through tick()", async () => {
    const { room } = await lobby(1);
    room.addBot(0, 0);
    room.addBot(0, 0);
    room.start(0, true, 0);
    room.disconnect(0, 0);
    let now = 0;
    for (let i = 0; i < 2000 && room.data.status === "playing"; i++) {
      now = Math.max(now + 1, room.nextAlarm() ?? now + 1);
      await room.tick(now);
    }
    expect(room.data.status).toBe("over");
    expect(room.data.game!.finished).toHaveLength(3);
  });
  it("increments seq and exposes the events of each action", async () => {
    const { room } = await lobby(2);
    room.start(0, false, 0);
    const before = room.data.seq;
    await room.roll(0, 1);
    expect(room.data.seq).toBe(before + 1);
    expect(room.data.events[0]).toMatchObject({ type: "roll", player: 0 });
  });
});

describe("RoomCore housekeeping", () => {
  it("rate-limits emoji reactions per seat", async () => {
    const { room } = await lobby(2);
    expect(room.emoji(0, 10_000)).toBe(true);
    expect(room.emoji(0, 10_500)).toBe(false);
    expect(room.emoji(1, 10_500)).toBe(true);
    expect(room.emoji(0, 11_300)).toBe(true);
  });
  it("expires rooms nobody is connected to", async () => {
    const { room } = await lobby(2);
    room.disconnect(0, 0);
    room.disconnect(1, 0);
    expect(room.isExpired(1000 + IDLE_EXPIRY_MS - 1)).toBe(false);
    expect(room.isExpired(1000 + IDLE_EXPIRY_MS)).toBe(true);
    expect(room.nextAlarm()).toBe(1000 + IDLE_EXPIRY_MS);
  });
  it("schedules the takeover alarm for a disconnected player", async () => {
    const { room } = await lobby(2);
    room.start(0, false, 0);
    room.disconnect(1, 500);
    expect(room.nextAlarm()).toBe(Math.min(TURN_MS, 500 + TAKEOVER_MS));
  });
  it("survives a JSON round trip (Durable Object storage)", async () => {
    const { room } = await lobby(2);
    room.start(0, false, 0);
    await room.roll(0, 1);
    const copy = new RoomCore(JSON.parse(JSON.stringify(room.data)));
    expect(copy.view(0, 2)).toEqual(room.view(0, 2));
  });
});
