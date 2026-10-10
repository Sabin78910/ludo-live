// Invite links: https://<site>/?room=CODE, plus WhatsApp and native share helpers.
import { normalizeRoomCode } from "../engine/protocol";

export function inviteLink(code: string, location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(code)}`;
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function roomFromSearch(search: string): string | null {
  return normalizeRoomCode(new URLSearchParams(search).get("room"));
}

/** URL without the ?room= parameter (after joining, so a refresh doesn't rejoin a finished game). */
export function stripRoomParam(href: string): string {
  const u = new URL(href);
  u.searchParams.delete("room");
  return u.toString();
}

/** WebSocket URL for a room, from VITE_WS_URL (http(s) URLs are converted to ws(s)). */
export function roomSocketUrl(base: string | undefined, code: string): string | null {
  if (!base) return null;
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!/^(wss?|https?):\/\//.test(trimmed)) return null;
  return `${trimmed.replace(/^http/, "ws")}/room/${code}`;
}
