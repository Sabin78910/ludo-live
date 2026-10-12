// Remembers locally whether the first-run intro has been shown. Never blocks play if storage fails.
import { safeStorage } from "./settings";

const KEY = "ludo-live.intro-seen";

/** If storage is unreadable we treat the intro as seen, so it can never nag on every launch. */
export function hasSeenIntro(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markIntroSeen(storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, "1");
  } catch {
    // Nothing to do: the intro just may show again.
  }
}
