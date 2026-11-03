import { describe, expect, it } from "vitest";
import { screenCorner, tableRows } from "./table";

describe("table seating", () => {
  it("matches the unrotated board yards", () => {
    expect(screenCorner("red", 0)).toBe("tl");
    expect(screenCorner("green", 0)).toBe("tr");
    expect(screenCorner("yellow", 0)).toBe("br");
    expect(screenCorner("blue", 0)).toBe("bl");
  });
  it("follows the board when it is rotated so your colour sits bottom-left", () => {
    // ROTATION.red is -90: red's yard turns to bottom-left.
    expect(screenCorner("red", -90)).toBe("bl");
    expect(screenCorner("yellow", 90)).toBe("bl");
    expect(screenCorner("green", 180)).toBe("bl");
  });
  it("leaves empty corners empty in a two player game", () => {
    expect(tableRows(["red", "yellow"], 0)).toEqual({ top: [0, null], bottom: [null, 1] });
  });
});
