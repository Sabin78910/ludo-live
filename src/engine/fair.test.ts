import { createHash, createHmac } from "node:crypto";
import {
  FairDealer,
  bytesToDie,
  cleanClientSeed,
  deriveRoll,
  hmacSha256,
  randomHex,
  rollMessage,
  sha256Hex,
  toHex,
  verifyRolls,
} from "./fair";

const SEED = "a3f1c9e07b2d4c6f8e1a0b9c7d5e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e";
const CLIENTS = ["alice123", "bob456"];

/** Independent reference implementation using Node's crypto module. */
function referenceRoll(seed: string, clients: string[], n: number): number {
  for (let attempt = 0; ; attempt++) {
    const bytes = createHmac("sha256", seed).update(rollMessage(clients, n, attempt)).digest();
    for (const b of bytes) if (b < 252) return (b % 6) + 1;
  }
}

describe("hashing", () => {
  it("sha256Hex matches Node crypto", async () => {
    expect(await sha256Hex(SEED)).toBe(createHash("sha256").update(SEED).digest("hex"));
  });
  it("hmacSha256 matches Node crypto", async () => {
    const ours = toHex(await hmacSha256(SEED, "hello:1"));
    expect(ours).toBe(createHmac("sha256", SEED).update("hello:1").digest("hex"));
  });
  it("randomHex returns the requested number of bytes and differs each time", () => {
    const a = randomHex(32);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(randomHex(32)).not.toBe(a);
  });
});

describe("bytesToDie", () => {
  it("maps bytes below 252 with modulo 6", () => {
    expect(bytesToDie(new Uint8Array([0]))).toBe(1);
    expect(bytesToDie(new Uint8Array([5]))).toBe(6);
    expect(bytesToDie(new Uint8Array([251]))).toBe(6);
  });
  it("rejects biased bytes 252-255 and uses the next byte", () => {
    expect(bytesToDie(new Uint8Array([252, 253, 254, 255, 7]))).toBe(2);
  });
  it("returns null when every byte is rejected", () => {
    expect(bytesToDie(new Uint8Array([255, 252]))).toBeNull();
  });
  it("is perfectly uniform over all accepted byte values", () => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (let b = 0; b < 252; b++) counts[bytesToDie(new Uint8Array([b]))! - 1]++;
    expect(counts).toEqual([42, 42, 42, 42, 42, 42]);
  });
});

describe("deriveRoll", () => {
  it("matches the reference implementation for many indices", async () => {
    for (let n = 0; n < 50; n++) expect(await deriveRoll(SEED, CLIENTS, n)).toBe(referenceRoll(SEED, CLIENTS, n));
  });
  it("is deterministic", async () => {
    expect(await deriveRoll(SEED, CLIENTS, 7)).toBe(await deriveRoll(SEED, CLIENTS, 7));
  });
  it("depends on the client seeds", async () => {
    const a: number[] = [];
    const b: number[] = [];
    for (let n = 0; n < 30; n++) {
      a.push(await deriveRoll(SEED, CLIENTS, n));
      b.push(await deriveRoll(SEED, ["alice123", "bob457"], n));
    }
    expect(a).not.toEqual(b);
  });
  it("produces fair dice (chi-square over 6000 rolls)", async () => {
    const counts = [0, 0, 0, 0, 0, 0];
    const N = 6000;
    for (let n = 0; n < N; n++) counts[(await deriveRoll(SEED, CLIENTS, n)) - 1]++;
    const expected = N / 6;
    const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi).toBeLessThan(20.5); // p ≈ 0.001 for 5 degrees of freedom
    expect(Math.min(...counts)).toBeGreaterThan(850);
  });
  it("rollMessage only appends the attempt when retrying", () => {
    expect(rollMessage(["a", "b"], 3)).toBe("a|b:3");
    expect(rollMessage(["a", "b"], 3, 2)).toBe("a|b:3:2");
  });
});

describe("cleanClientSeed", () => {
  it("keeps safe characters and trims length", () => {
    expect(cleanClientSeed("abc-DEF_09")).toBe("abc-DEF_09");
    expect(cleanClientSeed("a|b:c")).toBe("abc");
    expect(cleanClientSeed("x".repeat(100))).toHaveLength(64);
  });
  it("falls back for empty or non-string seeds", () => {
    expect(cleanClientSeed("")).toBe("anon");
    expect(cleanClientSeed(42)).toBe("anon");
  });
});

describe("FairDealer and verifyRolls", () => {
  it("publishes the hash of the secret seed", async () => {
    const d = await FairDealer.create(SEED);
    expect(d.serverSeedHash).toBe(await sha256Hex(SEED));
    expect(d.reveal()).toBe(SEED);
  });
  it("verifies an honest game", async () => {
    const d = await FairDealer.create();
    const rolls = [];
    for (let n = 0; n < 12; n++) rolls.push({ n, value: await d.roll(CLIENTS, n) });
    const res = await verifyRolls({ serverSeed: d.reveal(), serverSeedHash: d.serverSeedHash, clientSeeds: CLIENTS, rolls });
    expect(res.hashOk).toBe(true);
    expect(res.allOk).toBe(true);
    expect(res.checks).toHaveLength(12);
  });
  it("detects a tampered roll", async () => {
    const d = await FairDealer.create(SEED);
    const real = await d.roll(CLIENTS, 0);
    const res = await verifyRolls({
      serverSeed: SEED,
      serverSeedHash: d.serverSeedHash,
      clientSeeds: CLIENTS,
      rolls: [{ n: 0, value: (real % 6) + 1 }],
    });
    expect(res.allOk).toBe(false);
    expect(res.checks[0]).toMatchObject({ ok: false, expected: real });
  });
  it("detects a swapped seed (hash mismatch)", async () => {
    const d = await FairDealer.create(SEED);
    const res = await verifyRolls({ serverSeed: SEED + "0", serverSeedHash: d.serverSeedHash, clientSeeds: CLIENTS, rolls: [] });
    expect(res.hashOk).toBe(false);
    expect(res.allOk).toBe(false);
  });
  it("accepts an upper-case published hash", async () => {
    const d = await FairDealer.create(SEED);
    const res = await verifyRolls({ serverSeed: SEED, serverSeedHash: d.serverSeedHash.toUpperCase(), clientSeeds: [], rolls: [] });
    expect(res.hashOk).toBe(true);
  });
});
