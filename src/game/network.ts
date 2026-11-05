import { useEffect, useState } from "react";

/** What the online tile can offer: play, a "you're offline" note, or the coming-soon placeholder. */
export type OnlineState = "ready" | "offline" | "soon";

export function onlineState(wsUrl: string | undefined, online: boolean): OnlineState {
  if (!wsUrl) return "soon";
  return online ? "ready" : "offline";
}

function current(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** Tracks the device's connection so online rooms can be hidden while local play keeps working. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(current);
  useEffect(() => {
    const update = () => setOnline(current());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
