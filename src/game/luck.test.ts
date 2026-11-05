import { describe, expect, it } from "vitest";
import { diceLuck } from "./luck";

describe("diceLuck", () => {
  it("counts faces and sixes per player against the fair expectation", () => {
    const rolls = [
      { player: 0, value: 6 },
      { player: 0, value: 3 },
      { player: 1, value: 6 },
      { player: 0, value: 6 },
      { player: 1, value: 1 },
      { player: 0, value: 2 },
      { player: 0, value: 5 },
      { player: 0, value: 4 },
    ];
    const [a, b] = diceLuck(rolls, [0, 1]);
    expect(a).toEqual({ player: 0, rolls: 6, faces: [0, 1, 1, 1, 1, 2], sixes: 2, expectedSixes: 1 });
    expect(b.rolls).toBe(2);
    expect(b.sixes).toBe(1);
    expect(b.expectedSixes).toBe(0.3);
  });
  it("keeps players with no rolls and ignores impossible values", () => {
    expect(diceLuck([{ player: 2, value: 9 }], [2, 3])).toEqual([
      { player: 2, rolls: 0, faces: [0, 0, 0, 0, 0, 0], sixes: 0, expectedSixes: 0 },
      { player: 3, rolls: 0, faces: [0, 0, 0, 0, 0, 0], sixes: 0, expectedSixes: 0 },
    ]);
  });
});
