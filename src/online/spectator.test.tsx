import { render, screen } from "@testing-library/react";
import { GameView } from "../ui/GameView";
import { createGame } from "../engine/rules";
import type { Controller } from "../game/controller";

const state = createGame(
  [
    { color: "red", name: "A" },
    { color: "blue", name: "B" },
  ],
  { mode: "classic" },
);

const ctl: Controller = {
  state,
  events: [],
  seq: 0,
  prevTokens: null,
  local: [false, false],
  bots: [false, false],
  canAct: false,
  roll: vi.fn(),
  move: vi.fn(),
  deadline: null,
  fair: { serverSeedHash: "abc", clientSeeds: [], serverSeed: null },
};

describe("spectator view", () => {
  it("shows the board and the 👀 count but no reaction bar", () => {
    render(<GameView ctl={ctl} names={["A", "B"]} lang="en" sound={false} haptics={false} reduced onExit={vi.fn()} onVerify={vi.fn()} spectators={3} />);
    expect(screen.getByText(/👀 3/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Reactions")).toBeNull();
  });
});
