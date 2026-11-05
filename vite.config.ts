/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { injectPrecache } from "./src/game/precache";
import { inlineCss } from "./scripts/inline-css";

// Writes every built file into dist/sw.js so the app works offline from the first visit.
function precacheServiceWorker(): Plugin {
  let files: string[] = [];
  let outDir = "dist";
  return {
    name: "precache-service-worker",
    apply: "build",
    configResolved(c) {
      outDir = c.build.outDir;
    },
    generateBundle(_, bundle) {
      files = Object.keys(bundle);
    },
    closeBundle() {
      const sw = join(outDir, "sw.js");
      writeFileSync(sw, injectPrecache(readFileSync(sw, "utf8"), files));
    },
  };
}

// base "./" makes the build work under the GitHub Pages sub-path and inside the Capacitor app.
export default defineConfig({
  base: "./",
  plugins: [inlineCss(), react(), precacheServiceWorker()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    include: ["src/**/*.test.{ts,tsx}", "worker/src/**/*.test.ts"],
  },
});
