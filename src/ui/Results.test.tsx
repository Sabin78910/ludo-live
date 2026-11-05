import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Results } from "./Results";

describe("Results", () => {
  it("shows each player's sixes against the fair average", () => {
    const noop = () => {};
    render(
      <Results
        lang="en"
        title="Red wins"
        order={[{ name: "Red", color: "red" }, { name: "Blue", color: "blue" }]}
        reduced
        onHome={noop}
        onVerify={noop}
        luck={[
          { player: 0, name: "Red", color: "red", rolls: 12, faces: [2, 2, 2, 2, 1, 3], sixes: 3, expectedSixes: 2 },
          { player: 1, name: "Blue", color: "blue", rolls: 6, faces: [1, 1, 1, 1, 1, 1], sixes: 1, expectedSixes: 1 },
        ]}
      />,
    );
    expect(screen.getByRole("region", { name: "Dice this game" })).toBeTruthy();
    expect(screen.getByText("3 sixes in 12 rolls · fair average 2")).toBeTruthy();
  });
  it("hides the dice summary when nobody rolled", () => {
    render(<Results lang="en" title="Done" order={[]} reduced onHome={() => {}} onVerify={() => {}} />);
    expect(screen.queryByText("Dice this game")).toBeNull();
  });
});
