// Provably fair dice (commit-reveal).
// 1. The dealer (server, or the local dealer in bot games) creates a secret 32-byte seed and publishes
//    SHA-256(seed) BEFORE anyone joins or rolls.
// 2. Each player contributes a client seed; they are locked when the game starts.
// 3. Roll n = first byte b < 252 of HMAC-SHA256(key = seed, msg = clientSeeds.join("|") + ":" + n [+ ":" + attempt]),
//    mapped as (b % 6) + 1. 252 = 6 * 42, so rejecting bytes >= 252 removes modulo bias.
// 4. After the game the seed is revealed and anyone can recompute every roll (see verifyRolls).
// Uses WebCrypto, available in browsers, Cloudflare Workers and Node 20+.

const enc = new TextEncoder();

function subtle(): SubtleCrypto {
  const c = crypto;
  if (!c?.subtle) throw new Error("WebCrypto is not available");
  return c.subtle;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomHex(byteCount = 32): string {
  const b = new Uint8Array(byteCount);
  crypto.getRandomValues(b);
  return toHex(b);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await subtle().digest("SHA-256", enc.encode(text));
  return toHex(new Uint8Array(digest));
}

export async function hmacSha256(key: string, message: string): Promise<Uint8Array> {
  const k = await subtle().importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle().sign("HMAC", k, enc.encode(message)));
}

/** Unbiased die face from random bytes, or null if every byte was rejected. */
export function bytesToDie(bytes: Uint8Array): number | null {
  for (const b of bytes) if (b < 252) return (b % 6) + 1;
  return null;
}

export function rollMessage(clientSeeds: readonly string[], index: number, attempt = 0): string {
  const base = `${clientSeeds.join("|")}:${index}`;
  return attempt === 0 ? base : `${base}:${attempt}`;
}

export async function deriveRoll(serverSeed: string, clientSeeds: readonly string[], index: number): Promise<number> {
  for (let attempt = 0; attempt < 64; attempt++) {
    const face = bytesToDie(await hmacSha256(serverSeed, rollMessage(clientSeeds, index, attempt)));
    if (face !== null) return face;
  }
  throw new Error("Could not derive a roll"); // probability ~ (4/256)^(32*64): never happens
}

/** Client seeds are short printable strings; anything else is replaced so messages stay unambiguous. */
export function cleanClientSeed(seed: unknown): string {
  const s = typeof seed === "string" ? seed.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) : "";
  return s || "anon";
}

export interface FairCommit {
  serverSeedHash: string;
  clientSeeds: string[];
}

/** The dealer side of the scheme: keeps the secret seed until reveal(). */
export class FairDealer {
  private constructor(
    private readonly seed: string,
    readonly serverSeedHash: string,
  ) {}

  static async create(seed: string = randomHex(32)): Promise<FairDealer> {
    return new FairDealer(seed, await sha256Hex(seed));
  }

  roll(clientSeeds: readonly string[], index: number): Promise<number> {
    return deriveRoll(this.seed, clientSeeds, index);
  }

  reveal(): string {
    return this.seed;
  }
}

export interface RollCheck {
  n: number;
  claimed: number;
  expected: number;
  ok: boolean;
}

export interface VerifyResult {
  hashOk: boolean;
  computedHash: string;
  checks: RollCheck[];
  allOk: boolean;
}

/** Recompute the commitment and every roll from the revealed seed. */
export async function verifyRolls(input: {
  serverSeed: string;
  serverSeedHash: string;
  clientSeeds: readonly string[];
  rolls: readonly { n: number; value: number }[];
}): Promise<VerifyResult> {
  const computedHash = await sha256Hex(input.serverSeed);
  const hashOk = computedHash === input.serverSeedHash.toLowerCase();
  const checks: RollCheck[] = [];
  for (const r of input.rolls) {
    const expected = await deriveRoll(input.serverSeed, input.clientSeeds, r.n);
    checks.push({ n: r.n, claimed: r.value, expected, ok: expected === r.value });
  }
  return { hashOk, computedHash, checks, allOk: hashOk && checks.every((c) => c.ok) };
}
