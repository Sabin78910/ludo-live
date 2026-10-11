import { addFriends, friendKey, loadFriends, MAX_FRIENDS, parseFriends, removeFriend, saveFriends } from "./friends";

describe("friends", () => {
  it("adds players, newest first", () => {
    const l = addFriends(addFriends([], ["Sita"], 1), ["Ram"], 2);
    expect(l.map((f) => f.name)).toEqual(["Ram", "Sita"]);
  });
  it("dedupes by name ignoring case and refreshes the time", () => {
    const l = addFriends(addFriends([], ["Sita", "Ram"], 1), [" sita "], 5);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ name: "sita", lastPlayed: 5 });
  });
  it("skips blank names", () => {
    expect(addFriends([], ["", "  "], 1)).toEqual([]);
  });
  it("caps the list, dropping the oldest", () => {
    let l = addFriends([], Array.from({ length: MAX_FRIENDS + 5 }, (_, i) => `p${i}`), 1);
    expect(l).toHaveLength(MAX_FRIENDS);
    l = addFriends(l, ["new"], 2);
    expect(l).toHaveLength(MAX_FRIENDS);
    expect(l[0].name).toBe("new");
  });
  it("removes by id", () => {
    const l = addFriends([], ["Sita", "Ram"], 1);
    expect(removeFriend(l, friendKey("SITA")).map((f) => f.name)).toEqual(["Ram"]);
  });
  it("parses corrupt storage defensively", () => {
    expect(parseFriends(null)).toEqual([]);
    expect(parseFriends("{bad")).toEqual([]);
    expect(parseFriends('[{"name":"A","lastPlayed":3},{"x":1},7]')).toHaveLength(1);
  });
  it("round-trips through storage", () => {
    const m = new Map<string, string>();
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    saveFriends(addFriends([], ["Sita"], 9), st);
    expect(loadFriends(st)).toEqual([{ id: "sita", name: "Sita", lastPlayed: 9 }]);
  });
});
