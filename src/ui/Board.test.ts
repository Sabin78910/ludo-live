import { BOARDS } from "../engine/rules";
import { rotationFor } from "./Board";

describe("rotationFor", () => {
  it("keeps the classic rotations", () => {
    expect(rotationFor("blue")).toBe(0);
    expect(rotationFor("red", "classic")).toBe(-90);
  });
  it("turns every hex arm to the bottom of the screen", () => {
    // Arm k points at 270 + 60k degrees clockwise from up; the bottom is 180.
    BOARDS.hex.colors.forEach((c, k) => {
      expect((((270 + 60 * k + rotationFor(c, "hex")) % 360) + 360) % 360).toBe(180);
    });
  });
});
