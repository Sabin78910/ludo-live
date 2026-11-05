import { MAX_STRIKES, MSG_BURST, MSG_PER_SEC, newBucket, spend } from "./limits";

describe("per-socket rate limit", () => {
  it("allows a burst, then drops, then closes a flooding socket", () => {
    const b = newBucket(0);
    for (let i = 0; i < MSG_BURST; i++) expect(spend(b, 0)).toBe("ok");
    for (let i = 1; i < MAX_STRIKES; i++) expect(spend(b, 0)).toBe("drop");
    expect(spend(b, 0)).toBe("close");
  });

  it("refills over time so normal play is never limited", () => {
    const b = newBucket(0);
    for (let i = 0; i < MSG_BURST; i++) spend(b, 0);
    expect(spend(b, 0)).toBe("drop");
    expect(spend(b, 1000 / MSG_PER_SEC)).toBe("ok");
    // One message a second for ten minutes stays under the limit.
    for (let t = 1; t <= 600; t++) expect(spend(b, t * 1000)).toBe("ok");
  });

  it("a good message resets strikes", () => {
    const b = newBucket(0);
    for (let i = 0; i < MSG_BURST + 5; i++) spend(b, 0);
    expect(b.strikes).toBe(5);
    spend(b, 1000);
    expect(b.strikes).toBe(0);
  });
});
