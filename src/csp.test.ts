import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] ?? "";

describe("Content-Security-Policy", () => {
  it("is strict by default and blocks plugins and form posts", () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
  });
  it("allows only the hosts the app needs", () => {
    expect(csp).toContain("https://accounts.google.com/gsi/client");
    expect(csp).toContain("wss://*.workers.dev");
  });
});
