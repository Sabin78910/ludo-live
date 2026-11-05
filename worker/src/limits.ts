// Load protection for one room Durable Object. Pure so it can be unit tested.
// The bucket lives in each WebSocket's attachment, so it survives hibernation.

/** Most sockets one room accepts at once (4 seats plus reconnects in flight and spare tabs). */
export const MAX_SOCKETS_PER_ROOM = 12;
/** Sustained messages per second per socket. Real play is under 1/s; ping is every 10s. */
export const MSG_PER_SEC = 5;
/** Short bursts allowed (fast taps, reconnect hello + ping). */
export const MSG_BURST = 15;
/** Messages dropped in a row before the socket is closed. */
export const MAX_STRIKES = 30;

export interface Bucket {
  tokens: number;
  at: number;
  strikes: number;
}

export const newBucket = (now: number): Bucket => ({ tokens: MSG_BURST, at: now, strikes: 0 });

/** Spend one message. "ok" lets it through, "drop" ignores it, "close" means the socket keeps flooding. */
export function spend(b: Bucket, now: number): "ok" | "drop" | "close" {
  const elapsed = Math.max(0, now - b.at) / 1000;
  b.tokens = Math.min(MSG_BURST, b.tokens + elapsed * MSG_PER_SEC);
  b.at = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    b.strikes = 0;
    return "ok";
  }
  b.strikes += 1;
  return b.strikes >= MAX_STRIKES ? "close" : "drop";
}
