import { buildResultCard, cardFileName, shareCard } from "./resultCard";

const order = [
  { name: "Sita", color: "red" as const },
  { name: "Ram", color: "blue" as const },
  { name: "Gita", color: "green" as const },
];

describe("buildResultCard", () => {
  it("lists places in order with a hash prefix and verified flag", () => {
    const m = buildResultCard({ lang: "en", order, mode: "classic", fair: { serverSeedHash: "abcdef0123456789", serverSeed: "s" } });
    expect(m.places.map((p) => [p.place, p.name, p.label])).toEqual([
      [1, "Sita", "1st"],
      [2, "Ram", "2nd"],
      [3, "Gita", "3rd"],
    ]);
    expect(m.hashPrefix).toBe("abcdef0123");
    expect(m.verified).toBe(true);
    expect(m.badge).toContain("✓");
    expect(m.modeLabel).toBe("Classic");
  });
  it("is not verified until the seed is revealed", () => {
    const m = buildResultCard({ lang: "en", order, mode: "quick", fair: { serverSeedHash: "abc", serverSeed: null } });
    expect(m.verified).toBe(false);
    expect(m.modeLabel).toBe("Quick mode");
  });
  it("uses Nepali strings", () => {
    const m = buildResultCard({ lang: "ne", order, mode: "classic", fair: { serverSeedHash: "abc", serverSeed: "s" } });
    expect(m.places[0].label).toBe("पहिलो");
    expect(m.title).not.toBe("Ludo Live");
  });
});

describe("shareCard", () => {
  const blob = new Blob(["x"], { type: "image/png" });
  it("shares the file when the browser supports it", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const nav = { share, canShare: () => true };
    expect(await shareCard(blob, "t", nav, vi.fn())).toBe("shared");
    expect(share.mock.calls[0][0].files[0].name).toBe(cardFileName());
  });
  it("downloads when file sharing is unavailable", async () => {
    const download = vi.fn();
    expect(await shareCard(blob, "t", {}, download)).toBe("downloaded");
    expect(download).toHaveBeenCalledWith(blob, cardFileName());
  });
  it("does not download when the user cancels the share sheet", async () => {
    const download = vi.fn();
    const nav = { share: vi.fn().mockRejectedValue(new DOMException("x", "AbortError")), canShare: () => true };
    expect(await shareCard(blob, "t", nav, download)).toBe("cancelled");
    expect(download).not.toHaveBeenCalled();
  });
});
