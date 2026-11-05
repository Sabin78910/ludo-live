import { describe, expect, it } from "vitest";
import { accountFromIdToken, nicknameFrom } from "./account";

const enc = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const token = (p: object) => `${enc({ alg: "RS256" })}.${enc(p)}.sig`;
const base = { iss: "https://accounts.google.com", aud: "cid", exp: 2000, given_name: "Sabin", name: "Sabin K" };

describe("accountFromIdToken", () => {
  it("keeps only the name from a valid token", () => {
    expect(accountFromIdToken(token({ ...base, email: "x@y.z" }), "cid", 1000)).toEqual({ name: "Sabin" });
  });
  it("rejects another app, another issuer, an expired or a malformed token", () => {
    expect(accountFromIdToken(token(base), "other", 1000)).toBeNull();
    expect(accountFromIdToken(token({ ...base, iss: "evil.com" }), "cid", 1000)).toBeNull();
    expect(accountFromIdToken(token(base), "cid", 3000)).toBeNull();
    expect(accountFromIdToken("nope", "cid", 1000)).toBeNull();
  });
});

describe("nicknameFrom", () => {
  it("uses the first word, capped at 16 characters", () => {
    expect(nicknameFrom({ name: "Sabin Khanal" })).toBe("Sabin");
    expect(nicknameFrom({ name: "Abcdefghijklmnopqrst" })).toBe("Abcdefghijklmnop");
  });
});
