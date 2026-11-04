import { describe, expect, it } from "vitest";
import { CHEST_MAX, CHEST_MIN, chestReady, earnForGame, emptyRewards, openChest, parseRewards, SKIN_COST, unlockSkin } from "./rewards";

describe("sparks and dice skins", () => {
  it("the daily chest always pays, once per day, within a fixed range", () => {
    const low = openChest(emptyRewards(), "2026-11-04", () => 0)!;
    const high = openChest(emptyRewards(), "2026-11-04", () => 0.999)!;
    expect(low.amount).toBe(CHEST_MIN);
    expect(high.amount).toBe(CHEST_MAX);
    expect(openChest(low.rewards, "2026-11-04")).toBeNull();
    expect(chestReady(low.rewards, "2026-11-05")).toBe(true);
  });

  it("finishing a game earns sparks, winning earns more", () => {
    expect(earnForGame(emptyRewards(), false).sparks).toBe(5);
    expect(earnForGame(emptyRewards(), true).sparks).toBe(25);
  });

  it("unlocks a skin only with enough sparks, and only once", () => {
    expect(unlockSkin(emptyRewards(), "ruby")).toBeNull();
    const rich = { ...emptyRewards(), sparks: 100 };
    const r = unlockSkin(rich, "ruby")!;
    expect(r.sparks).toBe(100 - SKIN_COST.ruby);
    expect(r.owned).toContain("ruby");
    expect(unlockSkin(r, "ruby")).toBeNull();
  });

  it("parses junk safely and always owns classic", () => {
    expect(parseRewards("nope")).toEqual(emptyRewards());
    expect(parseRewards('{"sparks":-5,"owned":["hack","jade"],"chestDay":"x"}')).toEqual({ sparks: 0, owned: ["classic", "jade"], chestDay: null });
  });
});
