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
