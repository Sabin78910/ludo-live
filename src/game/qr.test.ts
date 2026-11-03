import { describe, expect, it } from "vitest";
import { QUIET_ZONE, qrPath } from "./qr";

describe("room QR code", () => {
  it("encodes an invite link into a valid QR grid", () => {
    const { size, d } = qrPath("https://sabin78910.github.io/ludo-live/?room=ABCDEF");
    // QR sizes are 17 + 4 * version.
    expect((size - 17) % 4).toBe(0);
    expect(size).toBeGreaterThanOrEqual(21);
    // The top-left finder pattern's corner module is always dark.
    expect(d.startsWith(`M${QUIET_ZONE} ${QUIET_ZONE}h1`)).toBe(true);
  });
  it("is deterministic so every phone shows the same code", () => {
    expect(qrPath("ROOM42").d).toBe(qrPath("ROOM42").d);
    expect(qrPath("ROOM42").d).not.toBe(qrPath("ROOM43").d);
  });
});
