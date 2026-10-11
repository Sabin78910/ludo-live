import { BASE, type GameEvent } from "../engine/rules";
import { CAPTURE_MS, ROLL_MS, STEP_MS, animDuration, buildFrames, eventToast } from "./anim";
import { allKeys, localDigits, t, tableFor } from "./i18n";
import { defaultSettings, detectLang, parseSettings } from "./settings";
import { inviteLink, roomFromSearch, roomSocketUrl, stripRoomParam, whatsappUrl } from "./share";

describe("i18n", () => {
  it("has a non-empty Nepali string for every key", () => {
    for (const k of allKeys()) expect(tableFor("ne")[k].trim().length).toBeGreaterThan(0);
  });
  it("interpolates variables", () => {
    expect(t("en", "turnOf", { name: "Sita" })).toBe("Sita's turn");
    expect(t("ne", "rollsVerified", { ok: 3, total: 4 })).toContain("3");
  });
  it("converts digits to Devanagari for Nepali", () => {
    expect(localDigits("ne", 2026)).toBe("२०२६");
    expect(localDigits("en", 12)).toBe("12");
  });
});

describe("settings", () => {
  const fb = defaultSettings();
  it("detects Nepali from the browser languages", () => {
    expect(detectLang(["ne-NP", "en"])).toBe("ne");
    expect(detectLang(["en-US"])).toBe("en");
  });
  it("falls back on corrupt or invalid values", () => {
    expect(parseSettings("{oops", fb)).toEqual(fb);
    const s = parseSettings(JSON.stringify({ players: 9, difficulty: "god", lang: "fr", clientSeed: "zz" }), fb);
    expect(s.players).toBe(fb.players);
    expect(s.difficulty).toBe(fb.difficulty);
    expect(s.lang).toBe(fb.lang);
    expect(s.clientSeed).toBe(fb.clientSeed);
    expect(s.playerId).toBe(fb.playerId);
  });
  it("keeps valid saved values", () => {
    const s = parseSettings(JSON.stringify({ players: 2, difficulty: "hard", lang: "ne", quick: true, sound: false }), fb);
    expect(s).toMatchObject({ players: 2, difficulty: "hard", lang: "ne", quick: true, sound: false });
  });
  it("creates a random hex client seed", () => {
    expect(defaultSettings().clientSeed).toMatch(/^[0-9a-f]{16}$/);
    expect(defaultSettings().playerId).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("share links", () => {
  const loc = { origin: "https://sabin78910.github.io", pathname: "/ludo-live/" };
  it("builds the ?room= invite link", () => {
    expect(inviteLink("ABCDEF", loc)).toBe("https://sabin78910.github.io/ludo-live/?room=ABCDEF");
  });
  it("builds a WhatsApp share URL", () => {
    expect(whatsappUrl("Join A&B")).toBe("https://wa.me/?text=Join%20A%26B");
  });
  it("reads and normalises the room param", () => {
    expect(roomFromSearch("?room=abcdef")).toBe("ABCDEF");
    expect(roomFromSearch("?room=bad")).toBeNull();
    expect(stripRoomParam("https://x.dev/a/?room=ABCDEF&x=1")).toBe("https://x.dev/a/?x=1");
  });
  it("derives the room WebSocket URL from VITE_WS_URL", () => {
    expect(roomSocketUrl(undefined, "ABCDEF")).toBeNull();
    expect(roomSocketUrl("https://ludo.example.workers.dev/", "ABCDEF")).toBe("wss://ludo.example.workers.dev/room/ABCDEF");
    expect(roomSocketUrl("ws://localhost:8787", "ABCDEF")).toBe("ws://localhost:8787/room/ABCDEF");
    expect(roomSocketUrl("ftp://nope", "ABCDEF")).toBeNull();
  });
});

describe("animation frames", () => {
  const start = [
    [3, BASE, BASE, BASE],
    [BASE, BASE, BASE, BASE],
  ];
  it("makes one frame per cell hopped", () => {
    const ev: GameEvent[] = [{ type: "move", player: 0, token: 0, from: 3, to: 6, path: [4, 5, 6] }];
    const frames = buildFrames(start, ev);
    expect(frames.map((f) => f.tokens[0][0])).toEqual([4, 5, 6]);
    expect(frames.at(-1)!.fx[0]).toMatchObject({ kind: "hop", last: true });
    expect(start[0][0]).toBe(3); // input untouched
  });
  it("sends captured tokens back to base after the move", () => {
    const ev: GameEvent[] = [
      { type: "move", player: 1, token: 0, from: BASE, to: 0, path: [0] },
      { type: "capture", player: 1, victim: 0, token: 0, cell: 26 },
    ];
    const frames = buildFrames(start, ev);
    expect(frames).toHaveLength(2);
    expect(frames[1].tokens[0][0]).toBe(BASE);
    expect(frames[1].ms).toBe(CAPTURE_MS);
  });
  it("adds dice time to the duration and shortens it for reduced motion", () => {
    const ev: GameEvent[] = [
      { type: "roll", player: 0, value: 2 },
      { type: "move", player: 0, token: 0, from: 3, to: 5, path: [4, 5] },
    ];
    expect(animDuration(ev, start)).toBe(ROLL_MS + 2 * STEP_MS);
    expect(animDuration(ev, start, true)).toBeLessThan(200);
  });
  it("picks the right toast", () => {
    expect(eventToast([{ type: "forfeit", player: 0 }])).toBe("threeSixes");
    expect(eventToast([{ type: "bonus", player: 0, reason: "six" }])).toBe("rolledSix");
    expect(eventToast([{ type: "turn", player: 1 }])).toBeNull();
  });
});
