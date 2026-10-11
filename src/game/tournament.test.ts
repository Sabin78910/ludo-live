import { advancers, champion, createTournament, currentTable, recordResult, TournamentError } from "./tournament";

const names = ["A", "B", "C", "D", "E", "F", "G", "H"];

describe("tournament", () => {
  it("seeds two semi tables of four and an empty final", () => {
    const t = createTournament(names);
    expect(t.tables.map((x) => x.id)).toEqual(["semi1", "semi2", "final"]);
    expect(t.tables[0].seats).toEqual([0, 2, 4, 6]);
    expect(t.tables[1].seats).toEqual([1, 3, 5, 7]);
    expect(t.tables[2].seats).toEqual([]);
    expect(currentTable(t)?.id).toBe("semi1");
    expect(champion(t)).toBeNull();
  });

  it("rejects the wrong number of players", () => {
    expect(() => createTournament(names.slice(0, 6))).toThrow(TournamentError);
  });

  it("advances the top two of each semi into the final in order", () => {
    let t = createTournament(names);
    t = recordResult(t, "semi1", [4, 0, 2, 6]);
    expect(currentTable(t)?.id).toBe("semi2");
    expect(t.tables[2].seats).toEqual([]);
    t = recordResult(t, "semi2", [3, 7, 1, 5]);
    expect(advancers(t.tables[0])).toEqual([4, 0]);
    expect(t.tables[2].seats).toEqual([4, 0, 3, 7]);
    expect(currentTable(t)?.id).toBe("final");
  });

  it("crowns the final winner and then has no table left", () => {
    let t = createTournament(names);
    t = recordResult(t, "semi1", [4, 0, 2, 6]);
    t = recordResult(t, "semi2", [3, 7, 1, 5]);
    t = recordResult(t, "final", [7, 4, 3, 0]);
    expect(champion(t)).toBe(7);
    expect(currentTable(t)).toBeNull();
  });

  it("does not mutate and rejects bad results", () => {
    const t = createTournament(names);
    expect(() => recordResult(t, "semi1", [0, 2, 4])).toThrow(TournamentError);
    expect(() => recordResult(t, "semi1", [1, 0, 2, 4])).toThrow(TournamentError);
    expect(() => recordResult(t, "final", [0, 1, 2, 3])).toThrow(TournamentError);
    const t2 = recordResult(t, "semi1", [0, 2, 4, 6]);
    expect(t.tables[0].result).toBeNull();
    expect(() => recordResult(t2, "semi1", [0, 2, 4, 6])).toThrow(TournamentError);
  });
});
