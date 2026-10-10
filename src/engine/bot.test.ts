import { chooseMove, scoreMoves, seededRandom, threatsTo, DIFFICULTIES } from "./bot";
import { BASE, FINISH, applyMove, applyRoll, autoMove, createGame, legalMoves, seatColors, type GameState } from "./rules";

const two = [
  { color: "red" as const, name: "A" },
  { color: "yellow" as const, name: "B" },
];

function rolled(tokens: number[][], value: number): GameState {
  return applyRoll({ ...createGame(two), tokens }, value).state;
}

describe("threatsTo", () => {
  it("counts opponents 1-6 cells behind", () => {
    // Yellow progress 1 is track 27; red cell 30 is 3 ahead of it.
    const g = { ...createGame(two), tokens: [[BASE, BASE, BASE, BASE], [1, BASE, BASE, BASE]] };
    expect(threatsTo(g, 0, 30)).toBe(1);
    expect(threatsTo(g, 0, 34)).toBe(0); // 7 away
  });
  it("ignores opponents about to turn into their home column", () => {
    // Yellow progress 49 = track 23; cell 25 is 2 ahead but yellow would be at 51 (home column).
    const g = { ...createGame(two), tokens: [[BASE, BASE, BASE, BASE], [49, BASE, BASE, BASE]] };
    expect(threatsTo(g, 0, 25)).toBe(0);
  });
});

describe("chooseMove", () => {
  it("every difficulty captures when it can (hard and normal deterministically)", () => {
    // Red token 0 at 24 can capture yellow at track 27 with a 3; token 1 just moves.
    const g = rolled([[24, 10, BASE, BASE], [1, BASE, BASE, BASE]], 3);
    expect(chooseMove(g, "hard", seededRandom(1))).toBe(0);
    expect(chooseMove(g, "normal", () => 0)).toBe(0);
  });
  it("hard bot brings a token out on a six instead of a small step", () => {
    const g = rolled([[30, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], 6);
    expect(chooseMove(g, "hard")).toBe(1);
  });
  it("hard bot prefers finishing a token", () => {
    const g = rolled([[52, 20, BASE, BASE], [BASE, BASE, BASE, BASE]], 4);
    expect(chooseMove(g, "hard")).toBe(0);
  });
  it("hard bot avoids landing right in front of an opponent", () => {
    // Option A: token 0 from 3 to 5 (track 5): yellow? no. Put a yellow token at track 2 (yellow progress 28).
    // Token 0: 3 -> 5 (3 ahead of yellow, danger). Token 1: 12 -> 14 (safe distance).
    const g = rolled([[3, 12, BASE, BASE], [28, BASE, BASE, BASE]], 2);
    expect(chooseMove(g, "hard")).toBe(1);
  });
  it("hard bot moves to a star for safety", () => {
    // Token 0: 5 -> 8 (star). Token 1: 15 -> 18 (unsafe, threatened by yellow at track 14 = progress 40).
    const g = rolled([[5, 15, BASE, BASE], [40, BASE, BASE, BASE]], 3);
    expect(chooseMove(g, "hard")).toBe(0);
  });
  it("returns the only legal move straight away", () => {
    const g = rolled([[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], 3);
    expect(chooseMove(g, "easy", () => 0.99)).toBe(0);
  });
  it("always returns a legal move for every difficulty", () => {
    const rand = seededRandom(7);
    const g = rolled([[3, 12, 40, BASE], [28, 5, BASE, BASE]], 6);
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < 20; i++) expect(legalMoves(g)).toContain(chooseMove(g, d, rand));
    }
  });
  it("throws when there is nothing to move", () => {
    expect(() => chooseMove(createGame(two), "hard")).toThrow();
  });
  it("scores a capture above a plain move", () => {
    const g = rolled([[24, 10, BASE, BASE], [1, BASE, BASE, BASE]], 3);
    const [cap, plain] = scoreMoves(g);
    expect(cap.score).toBeGreaterThan(plain.score + 50);
  });
});

describe("seededRandom", () => {
  it("is deterministic and in [0,1)", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

/** Play a full bot-vs-bot game with seeded dice; checks rule invariants on every step. */
function simulate(players: number, seed: number, difficulty: "easy" | "normal" | "hard", quick = false) {
  const rand = seededRandom(seed);
  let g = createGame(seatColors(players).map((color, i) => ({ color, name: `B${i}` })), { mode: quick ? "quick" : "classic" });
  let steps = 0;
  while (g.phase !== "over" && steps < 20000) {
    steps++;
    const before = g.tokens.flat().filter((p) => p === FINISH).length;
    g = applyRoll(g, 1 + Math.floor(rand() * 6)).state;
    if (g.phase === "move") {
      const token = autoMove(g) ?? chooseMove(g, difficulty, rand);
      g = applyMove(g, token).state;
    }
    const after = g.tokens.flat().filter((p) => p === FINISH).length;
    expect(after).toBeGreaterThanOrEqual(before); // finished tokens never leave home
    for (const t of g.tokens.flat()) expect(t >= -1 && t <= FINISH).toBe(true);
  }
  return { g, steps };
}

describe("full simulated games", () => {
  it.each([
    [2, 1, "hard"],
    [3, 2, "normal"],
    [4, 3, "easy"],
    [4, 4, "hard"],
  ] as const)("%i players (seed %i, %s) finish with a complete winner order", (players, seed, diff) => {
    const { g } = simulate(players, seed, diff);
    expect(g.phase).toBe("over");
    expect([...g.finished].sort()).toEqual([...Array(players).keys()]);
    expect(g.rolls).toHaveLength(g.rollCount);
  });
  it("quick games end as soon as one token gets home", () => {
    const { g } = simulate(4, 9, "hard", true);
    expect(g.phase).toBe("over");
    expect(g.tokens.flat().filter((p) => p === FINISH)).toHaveLength(1);
  });
  it("hard bots beat easy bots most of the time", () => {
    let hardWins = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const rand = seededRandom(seed * 101);
      let g = createGame(two);
      while (g.phase !== "over") {
        g = applyRoll(g, 1 + Math.floor(rand() * 6)).state;
        if (g.phase === "move") g = applyMove(g, chooseMove(g, g.current === 0 ? "hard" : "easy", rand)).state;
      }
      if (g.finished[0] === 0) hardWins++;
    }
    expect(hardWins).toBeGreaterThan(17);
  });
});
