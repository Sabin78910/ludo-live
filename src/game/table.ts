// Where each player sits around the board on screen, so their pod (avatar, name, dice) sits beside
// their own yard, the way people sit around a real Ludo board.
import type { Color } from "../engine/rules";

export type Corner = "tl" | "tr" | "br" | "bl";
const CLOCKWISE: readonly Corner[] = ["tl", "tr", "br", "bl"];
/** Yard corners on the unrotated board (see BASE_ORIGIN). */
const HOME: Record<Color, number> = { red: 0, green: 1, yellow: 2, blue: 3 };

/** Screen corner of a colour's yard when the board is rotated by `rotation` degrees (a multiple of 90). */
export function screenCorner(color: Color, rotation: number): Corner {
  const steps = Math.round(rotation / 90);
  return CLOCKWISE[(((HOME[color] + steps) % 4) + 4) % 4];
}

/** Player indexes for the top row (left, right) and bottom row (left, right); null where nobody sits. */
export function tableRows(colors: readonly Color[], rotation: number): { top: (number | null)[]; bottom: (number | null)[] } {
  const at = (corner: Corner) => {
    const i = colors.findIndex((c) => screenCorner(c, rotation) === corner);
    return i >= 0 ? i : null;
  };
  return { top: [at("tl"), at("tr")], bottom: [at("bl"), at("br")] };
}
