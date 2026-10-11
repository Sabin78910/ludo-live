// Player preferences saved in localStorage. Reads are defensive: storage can be missing or corrupt.
import type { Difficulty } from "../engine/bot";
import { randomHex } from "../engine/fair";
import type { Lang } from "./i18n";

export interface Settings {
  lang: Lang;
  sound: boolean;
  haptics: boolean;
  name: string;
  difficulty: Difficulty;
  players: number;
  quick: boolean;
  /** This device's contribution to the fair-dice seeds. */
  clientSeed: string;
}

const KEY = "ludo-live.settings";

export function defaultSettings(lang: Lang = "en"): Settings {
  return {
    lang,
    sound: true,
    haptics: true,
    name: "",
    difficulty: "normal",
    players: 4,
    quick: false,
    clientSeed: randomHex(8),
  };
}

export function detectLang(languages: readonly string[] = typeof navigator !== "undefined" ? navigator.languages ?? [] : []): Lang {
  return languages.some((l) => l.toLowerCase().startsWith("ne")) ? "ne" : "en";
}

export function parseSettings(raw: string | null, fallback: Settings): Settings {
  if (!raw) return fallback;
  try {
    const o = JSON.parse(raw) as Partial<Settings>;
    return {
      lang: o.lang === "ne" || o.lang === "en" ? o.lang : fallback.lang,
      sound: typeof o.sound === "boolean" ? o.sound : fallback.sound,
      haptics: typeof o.haptics === "boolean" ? o.haptics : fallback.haptics,
      name: typeof o.name === "string" ? o.name.slice(0, 16) : fallback.name,
      difficulty: o.difficulty === "easy" || o.difficulty === "hard" || o.difficulty === "normal" ? o.difficulty : fallback.difficulty,
      players: typeof o.players === "number" && o.players >= 2 && o.players <= 6 ? Math.round(o.players) : fallback.players,
      quick: typeof o.quick === "boolean" ? o.quick : fallback.quick,
      clientSeed: typeof o.clientSeed === "string" && /^[0-9a-f]{8,64}$/.test(o.clientSeed) ? o.clientSeed : fallback.clientSeed,
    };
  } catch {
    return fallback;
  }
}

export function loadSettings(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Settings {
  const fallback = defaultSettings(detectLang());
  try {
    return parseSettings(storage?.getItem(KEY) ?? null, fallback);
  } catch {
    return fallback;
  }
}

export function saveSettings(s: Settings, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or full storage: settings just won't persist.
  }
}

export function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
