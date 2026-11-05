import { describe, expect, it } from "vitest";
import { buildVersion, injectPrecache, precacheList } from "./precache";

describe("service worker precache", () => {
  it("lists built files relative to the app and skips maps and the worker itself", () => {
    expect(precacheList(["assets/index-a1.js", "index.html", "assets/index-a1.js.map", "assets/f.woff", "sw.js"])).toEqual([
      "./assets/index-a1.js",
      "./index.html",
    ]);
  });

  it("injects the file list and a build-specific cache name", () => {
    const sw = 'const CACHE = "app-__BUILD__";\nconst PRECACHE = self.__PRECACHE__ || [];';
    const out = injectPrecache(sw, ["index.html", "assets/a.js"]);
    expect(out).toContain('["./assets/a.js","./index.html"]');
    expect(out).not.toContain("__BUILD__");
    expect(out).not.toContain("__PRECACHE__");
  });

  it("changes the cache name when the build changes", () => {
    expect(buildVersion(["./assets/a.js"])).not.toBe(buildVersion(["./assets/b.js"]));
    expect(buildVersion(["./assets/a.js"])).toBe(buildVersion(["./assets/a.js"]));
  });
});
