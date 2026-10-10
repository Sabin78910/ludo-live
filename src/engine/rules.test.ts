import {
  BASE,
  FINISH,
  RuleError,
  START_OFFSET,
  applyMove,
  applyRoll,
  autoMove,
  createGame,
  distinctMoves,
  isSafeIndex,
  legalMoves,
  passTurn,
  seatColors,
  target,
  totalProgress,
  trackIndex,
  animationSteps,
  type GameState,
  type Player,
} from "./rules";

const two: Player[] = [
  { color: "red", name: "A" },
  { color: "yellow", name: "B" },
];
const four: Player[] = seatColors(4).map((color, i) => ({ color, name: `P${i}` }));

function setup(tokens: number[][], players: Player[] = two, extra: Partial<GameState> = {}): GameState {
  return { ...createGame(players), tokens: tokens.map((t) => [...t]), ...extra };
}

describe("createGame", () => {
  it("puts every token in base for a classic game", () => {
    const g = createGame(four);
    expect(g.tokens).toHaveLength(4);
    expect(g.tokens.flat().every((p) => p === BASE)).toBe(true);
    expect(g.phase).toBe("roll");
    expect(g.current).toBe(0);
  });
  it("starts one token out per player in quick mode", () => {
    const g = createGame(two, { mode: "quick" });
    expect(g.tokens[0]).toEqual([0, BASE, BASE, BASE]);
    expect(g.tokens[1]).toEqual([0, BASE, BASE, BASE]);
    expect(g.mode).toBe("quick");
  });
  it("rejects fewer than 2 or more than 4 players", () => {
    expect(() => createGame([two[0]])).toThrow(RuleError);
    expect(() => createGame([...four, { color: "red", name: "X" }])).toThrow(RuleError);
  });
  it("rejects duplicate colours", () => {
    expect(() => createGame([two[0], { color: "red", name: "C" }])).toThrow(RuleError);
  });
  it("does not share player objects with the caller", () => {
    const players = [...two.map((p) => ({ ...p }))];
    const g = createGame(players);
    players[0].name = "changed";
    expect(g.players[0].name).toBe("A");
  });
});

describe("seatColors", () => {
  it("seats two players opposite each other", () => expect(seatColors(2)).toEqual(["red", "yellow"]));
  it("uses three adjacent colours for three players", () => expect(seatColors(3)).toEqual(["red", "green", "yellow"]));
  it("uses all four colours clockwise", () => expect(seatColors(4)).toEqual(["red", "green", "yellow", "blue"]));
  it("throws for unsupported table sizes", () => expect(() => seatColors(5)).toThrow());
});

describe("track geometry helpers", () => {
  it("maps progress 0 to each colour's start offset", () => {
    for (const c of ["red", "green", "yellow", "blue"] as const) expect(trackIndex(c, 0)).toBe(START_OFFSET[c]);
  });
  it("wraps around the 52-cell track", () => {
    expect(trackIndex("blue", 13)).toBe(0);
    expect(trackIndex("green", 50)).toBe(11);
  });
  it("returns null off the shared track", () => {
    expect(trackIndex("red", BASE)).toBeNull();
    expect(trackIndex("red", 51)).toBeNull();
    expect(trackIndex("red", FINISH)).toBeNull();
  });
  it("marks starts and stars as safe and other cells unsafe", () => {
    for (const i of [0, 8, 13, 21, 26, 34, 39, 47]) expect(isSafeIndex(i)).toBe(true);
    for (const i of [1, 5, 12, 30, 51]) expect(isSafeIndex(i)).toBe(false);
  });
});

describe("target", () => {
  it("needs a 6 to leave base", () => {
    expect(target(BASE, 6)).toBe(0);
    for (const r of [1, 2, 3, 4, 5]) expect(target(BASE, r)).toBeNull();
  });
  it("moves along the track", () => expect(target(10, 4)).toBe(14));
  it("needs an exact roll to finish", () => {
    expect(target(52, 4)).toBe(FINISH);
    expect(target(52, 5)).toBeNull();
    expect(target(55, 1)).toBe(FINISH);
  });
  it("never moves finished tokens", () => expect(target(FINISH, 1)).toBeNull());
  it("rejects impossible dice values", () => {
    expect(target(3, 0)).toBeNull();
    expect(target(3, 7)).toBeNull();
  });
});

describe("applyRoll", () => {
  it("records the roll with the global counter", () => {
    const { state } = applyRoll(setup([[5, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]]), 3);
    expect(state.rolls).toEqual([{ n: 0, player: 0, value: 3 }]);
    expect(state.rollCount).toBe(1);
    expect(state.phase).toBe("move");
    expect(state.dice).toBe(3);
  });
  it("passes the turn when no token can move", () => {
    const { state, events } = applyRoll(createGame(two), 4);
    expect(state.current).toBe(1);
    expect(state.phase).toBe("roll");
    expect(events.map((e) => e.type)).toEqual(["roll", "noMoves", "turn"]);
  });
  it("lets a 6 bring a token out", () => {
    const { state } = applyRoll(createGame(two), 6);
    expect(state.phase).toBe("move");
    expect(legalMoves(state)).toEqual([0, 1, 2, 3]);
  });
  it("forfeits the turn on the third six in a row", () => {
    let g = setup([[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]]);
    g = applyMove(applyRoll(g, 6).state, 0).state; // six → bonus
    expect(g.current).toBe(0);
    g = applyMove(applyRoll(g, 6).state, 0).state; // second six → bonus
    expect(g.sixes).toBe(2);
    const { state, events } = applyRoll(g, 6);
    expect(events.some((e) => e.type === "forfeit")).toBe(true);
    expect(state.current).toBe(1);
    expect(state.tokens[0][0]).toBe(22); // the third six is not played
    expect(state.sixes).toBe(0);
  });
  it("throws when rolling during the move phase", () => {
    const g = applyRoll(createGame(two), 6).state;
    expect(() => applyRoll(g, 3)).toThrow(RuleError);
  });
  it("throws for invalid dice values", () => {
    expect(() => applyRoll(createGame(two), 0)).toThrow(RuleError);
    expect(() => applyRoll(createGame(two), 7)).toThrow(RuleError);
    expect(() => applyRoll(createGame(two), 2.5)).toThrow(RuleError);
  });
  it("does not mutate the input state", () => {
    const g = createGame(two);
    applyRoll(g, 6);
    expect(g.rolls).toEqual([]);
    expect(g.phase).toBe("roll");
  });
});

describe("applyMove", () => {
  it("brings a token out onto progress 0 with a bonus roll", () => {
    const g = applyRoll(createGame(two), 6).state;
    const { state, events } = applyMove(g, 2);
    expect(state.tokens[0][2]).toBe(0);
    expect(state.current).toBe(0);
    expect(state.phase).toBe("roll");
    expect(events).toContainEqual({ type: "bonus", player: 0, reason: "six" });
  });
  it("walks cell by cell and reports the path", () => {
    const g = applyRoll(setup([[3, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]]), 4).state;
    const { events } = applyMove(g, 0);
    expect(events[0]).toEqual({ type: "move", player: 0, token: 0, from: 3, to: 7, path: [4, 5, 6, 7] });
  });
  it("passes the turn after a normal move", () => {
    const g = applyRoll(setup([[3, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]]), 2).state;
    const { state } = applyMove(g, 0);
    expect(state.current).toBe(1);
    expect(state.phase).toBe("roll");
    expect(state.dice).toBeNull();
  });
  it("captures an opponent on an unsafe cell and grants a bonus roll", () => {
    // Yellow progress 1 = track 27; red needs progress 27.
    const g = applyRoll(setup([[24, BASE, BASE, BASE], [1, BASE, BASE, BASE]]), 3).state;
    const { state, events } = applyMove(g, 0);
    expect(state.tokens[1][0]).toBe(BASE);
    expect(events).toContainEqual({ type: "capture", player: 0, victim: 1, token: 0, cell: 27 });
    expect(events).toContainEqual({ type: "bonus", player: 0, reason: "capture" });
    expect(state.current).toBe(0);
  });
  it("captures every opponent token on that cell", () => {
    const g = applyRoll(setup([[24, BASE, BASE, BASE], [1, 1, BASE, BASE]]), 3).state;
    const { state } = applyMove(g, 0);
    expect(state.tokens[1]).toEqual([BASE, BASE, BASE, BASE]);
  });
  it("does not capture on a star", () => {
    // Red progress 34 = track 34 (star). Yellow progress 8 = track 34.
    const g = applyRoll(setup([[30, BASE, BASE, BASE], [8, BASE, BASE, BASE]]), 4).state;
    const { state } = applyMove(g, 0);
    expect(state.tokens[1][0]).toBe(8);
    expect(state.current).toBe(1);
  });
  it("does not capture on an opponent's start cell", () => {
    // Red progress 26 = yellow start (track 26).
    const g = applyRoll(setup([[22, BASE, BASE, BASE], [0, BASE, BASE, BASE]]), 4).state;
    expect(applyMove(g, 0).state.tokens[1][0]).toBe(0);
  });
  it("never captures your own tokens", () => {
    const g = applyRoll(setup([[5, 9, BASE, BASE], [BASE, BASE, BASE, BASE]]), 4).state;
    expect(applyMove(g, 0).state.tokens[0]).toEqual([9, 9, BASE, BASE]);
  });
  it("tokens in the home column are out of reach", () => {
    // Red at 51 (home column) cannot be captured by anyone.
    const g = applyRoll(setup([[51, BASE, BASE, BASE], [10, BASE, BASE, BASE]], two, { current: 1 }), 3).state;
    const { state } = applyMove(g, 0);
    expect(state.tokens[0][0]).toBe(51);
  });
  it("reaching home grants a bonus roll", () => {
    const g = applyRoll(setup([[53, 10, BASE, BASE], [BASE, BASE, BASE, BASE]]), 3).state;
    const { state, events } = applyMove(g, 0);
    expect(state.tokens[0][0]).toBe(FINISH);
    expect(events).toContainEqual({ type: "home", player: 0, token: 0 });
    expect(events).toContainEqual({ type: "bonus", player: 0, reason: "home" });
    expect(state.current).toBe(0);
  });
  it("a capture bonus with a non-six resets the run of sixes", () => {
    const g = applyRoll(setup([[24, BASE, BASE, BASE], [1, BASE, BASE, BASE]], two, { sixes: 2 }), 3).state;
    expect(applyMove(g, 0).state.sixes).toBe(0);
  });
  it("rejects illegal tokens and moving before rolling", () => {
    const g = createGame(two);
    expect(() => applyMove(g, 0)).toThrow(RuleError);
    const rolled = applyRoll(setup([[3, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]]), 2).state;
    expect(() => applyMove(rolled, 1)).toThrow(RuleError);
    expect(() => applyMove(rolled, 9)).toThrow(RuleError);
  });
});

describe("finishing and winner order", () => {
  it("records a player who brings every token home", () => {
    const g = applyRoll(setup([[FINISH, FINISH, FINISH, 55], [BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], four.slice(0, 3)), 1).state;
    const { state, events } = applyMove(g, 3);
    expect(state.finished).toEqual([0]);
    expect(events).toContainEqual({ type: "finish", player: 0, place: 1 });
    expect(state.phase).toBe("roll");
    expect(state.current).toBe(1);
  });
  it("ends the game when only one player is left and ranks by progress", () => {
    const g = applyRoll(setup([[FINISH, FINISH, FINISH, 55], [10, BASE, BASE, BASE]]), 1).state;
    const { state, events } = applyMove(g, 3);
    expect(state.phase).toBe("over");
    expect(state.finished).toEqual([0, 1]);
    expect(events.at(-1)).toEqual({ type: "over", order: [0, 1] });
  });
  it("skips finished players when passing the turn", () => {
    const players = four.slice(0, 3);
    const g = setup([[5, BASE, BASE, BASE], [FINISH, FINISH, FINISH, FINISH], [BASE, BASE, BASE, BASE]], players, {
      finished: [1],
    });
    const { state } = applyMove(applyRoll(g, 2).state, 0);
    expect(state.current).toBe(2);
  });
  it("ranks leftover players by distance travelled", () => {
    const players = four.slice(0, 3);
    const g = applyRoll(
      setup([[FINISH, FINISH, FINISH, 55], [FINISH, FINISH, FINISH, FINISH], [3, BASE, BASE, BASE]], players, { finished: [1] }),
      1,
    ).state;
    const { state } = applyMove(g, 3);
    expect(state.finished).toEqual([1, 0, 2]);
    expect(state.phase).toBe("over");
  });
  it("quick mode: the first token home wins immediately", () => {
    const g = applyRoll({ ...createGame(four, { mode: "quick" }), tokens: [[54, BASE, BASE, BASE], [20, BASE, BASE, BASE], [3, BASE, BASE, BASE], [40, BASE, BASE, BASE]] }, 2).state;
    const { state, events } = applyMove(g, 0);
    expect(state.phase).toBe("over");
    expect(state.finished).toEqual([0, 3, 1, 2]);
    expect(events).toContainEqual({ type: "finish", player: 0, place: 1 });
  });
});

describe("move helpers", () => {
  it("distinctMoves collapses tokens sharing a position", () => {
    const g = applyRoll(createGame(two), 6).state;
    expect(distinctMoves(g)).toEqual([0]);
    expect(autoMove(g)).toBe(0);
  });
  it("autoMove is null when there is a real choice", () => {
    const g = applyRoll(setup([[3, 7, BASE, BASE], [BASE, BASE, BASE, BASE]]), 2).state;
    expect(autoMove(g)).toBeNull();
  });
  it("legalMoves is empty outside the move phase", () => expect(legalMoves(createGame(two))).toEqual([]));
  it("totalProgress counts tokens out of base", () => {
    const g = setup([[BASE, 0, 10, FINISH], [BASE, BASE, BASE, BASE]]);
    expect(totalProgress(g, 0)).toBe(0 + 1 + 11 + 57);
  });
  it("passTurn moves to the next player", () => {
    expect(passTurn(createGame(two)).state.current).toBe(1);
  });
  it("animationSteps counts move cells and captures", () => {
    expect(animationSteps([{ type: "move", player: 0, token: 0, from: 1, to: 4, path: [2, 3, 4] }])).toBe(3);
    expect(animationSteps([{ type: "capture", player: 0, victim: 1, token: 0, cell: 3 }])).toBe(4);
  });
});
