import { render, screen } from "@testing-library/react";
import { Results } from "./Results";

const base = { lang: "en" as const, title: "You win!", order: [{ name: "You", color: "red" as const }], reduced: true, onHome() {}, onVerify() {} };

describe("Results trophy track", () => {
  it("celebrates a freshly earned trophy", () => {
    render(<Results {...base} wins={3} won />);
    expect(screen.getByText("New trophy: 3 wins!")).toBeInTheDocument();
  });

  it("shows the distance to the next trophy, and nothing without stats", () => {
    const { rerender } = render(<Results {...base} wins={4} won={false} />);
    expect(screen.getByText("1 more wins to the 5-win trophy")).toBeInTheDocument();
    rerender(<Results {...base} />);
    expect(screen.queryByText(/trophy/)).not.toBeInTheDocument();
  });
});
