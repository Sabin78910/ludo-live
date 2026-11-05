// Optional Google sign-in, profile only. Only the display name is kept, on this device.
export interface Account {
  name: string;
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/**
 * Reads the account from a Google ID token after checking it was issued by Google for this app
 * and has not expired. There is no backend check, so this is for display only, never for trust.
 */
export function accountFromIdToken(token: string, clientId: string, nowSec = Date.now() / 1000): Account | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(b64urlDecode(parts[1]));
  } catch {
    return null;
  }
  const issOk = p.iss === "accounts.google.com" || p.iss === "https://accounts.google.com";
  if (!issOk || p.aud !== clientId || typeof p.exp !== "number" || p.exp < nowSec) return null;
  const name = typeof p.given_name === "string" ? p.given_name : typeof p.name === "string" ? p.name : "";
  return name.trim() ? { name: name.trim() } : null;
}

/** A nickname from the account: first word, at most 16 characters (the name field's limit). */
export function nicknameFrom(a: Account): string {
  return (a.name.trim().split(/\s+/)[0] ?? "").slice(0, 16);
}
