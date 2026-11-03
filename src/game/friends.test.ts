import { describe, expect, it } from "vitest";
import { MAX_FRIENDS, forgetFriend, parseFriends, rememberPlayers } from "./friends";

describe("recent players", () => {
  it("keeps newest first and counts games together", () => {
    let list = rememberPlayers([], ["Sita", "Ram"], 1);
    list = rememberPlayers(list, ["sita "], 2);
    expect(list.map((f) => f.name)).toEqual(["sita", "Ram"]);
    expect(list[0].games).toBe(2);
  });
  it("ignores blank names and caps the list", () => {
    const names = Array.from({ length: MAX_FRIENDS + 3 }, (_, i) => `P${i}`);
    const list = rememberPlayers([], ["  ", ...names], 5);
    expect(list).toHaveLength(MAX_FRIENDS);
    expect(list.every((f) => f.name.trim())).toBe(true);
  });
  it("forgets a player on request", () => {
    expect(forgetFriend(rememberPlayers([], ["A", "B"], 1), "A").map((f) => f.name)).toEqual(["B"]);
  });
  it("survives corrupt storage", () => {
    expect(parseFriends("{bad")).toEqual([]);
    expect(parseFriends(JSON.stringify([{ name: 3 }, { name: "Ok", last: 1, games: 0 }]))).toEqual([{ name: "Ok", last: 1, games: 1 }]);
  });
});
