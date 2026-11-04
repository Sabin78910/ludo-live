import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// A rule left open swallows every rule after it, silently. Vite does not fail the build for it.
describe("index.css", () => {
  it("closes every block it opens", () => {
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    let depth = 0;
    for (const ch of css) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });
});

// Lobby hero art (Canva): keep it light and the title side readable at AA.
describe("lobby hero art", () => {
  const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
  const rule = css.slice(css.indexOf(".hero-card {"), css.indexOf("}", css.indexOf(".hero-card {")));

  it("uses the bundled WebP and keeps it under 60KB", () => {
    expect(rule).toContain('url("./assets/lobby-hero.webp")');
    const bytes = readFileSync(resolve(process.cwd(), "src/assets/lobby-hero.webp"));
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(bytes.length).toBeLessThan(60 * 1024);
  });

  it("scrims the title side so muted text passes AA even over white art", () => {
    const stops = [...rule.matchAll(/rgba\(11, 16, 38, ([\d.]+)\) (\d+)%/g)].map((m) => ({ a: Number(m[1]), at: Number(m[2]) }));
    const titleSide = stops.filter((s) => s.at <= 48);
    expect(titleSide.length).toBeGreaterThan(0);
    const lum = (hex: number[]) =>
      hex.map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
    const muted = [0xaa, 0xb3, 0xd6];
    for (const { a } of titleSide) {
      const worst = [11, 16, 38].map((c) => c * a + 255 * (1 - a)); // scrim over pure white
      const ratio = (lum(muted) + 0.05) / (lum(worst) + 0.05);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
