import { WeekBoard } from "./board";

describe("WeekBoard", () => {
  it("counts wins per player and ranks by wins then earliest", () => {
    const b = new WeekBoard("2026-W42");
    b.recordWin("ana1", "Ana", 1);
    b.recordWin("bo01", "Bo", 2);
    b.recordWin("bo01", "Bo", 3);
    b.recordWin("cy01", "Cy", 4);
    expect(b.top(10).map((e) => [e.name, e.wins])).toEqual([["Bo", 2], ["Ana", 1], ["Cy", 1]]);
  });
  it("caps the stored top list and reports a player's ladder", () => {
    const b = new WeekBoard("2026-W42");
    for (let i = 0; i < 3; i++) b.recordWin("ana1", "Ana", i);
    expect(b.view("ana1").rewards).toEqual(["token-spark", "dice-aurora"]);
    expect(b.view("ana1").next).toMatchObject({ wins: 5, remaining: 2 });
    expect(b.top(1)).toHaveLength(1);
  });
  it("ignores ids that are not well formed", () => {
    const b = new WeekBoard("2026-W42");
    b.recordWin("", "X", 1);
    b.recordWin("<script>", "X", 1);
    expect(b.top(10)).toEqual([]);
  });
});
