import { hasSeenIntro, markIntroSeen } from "./onboarding";

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  };
}

describe("first-run intro", () => {
  it("is unseen on a fresh device, then remembered once marked", () => {
    const s = memory();
    expect(hasSeenIntro(s)).toBe(false);
    markIntroSeen(s);
    expect(hasSeenIntro(s)).toBe(true);
  });

  it("does not crash when storage is missing or throws", () => {
    const bad = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(() => markIntroSeen(bad)).not.toThrow();
    expect(hasSeenIntro(bad)).toBe(true);
    expect(() => markIntroSeen(undefined)).not.toThrow();
  });
});
