import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ludo-live.intro-seen", "1");
  });

  it("shows the three modes and the online placeholder when VITE_WS_URL is unset", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Ludo Live" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Play vs bots/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pass & play/ })).toBeInTheDocument();
    expect(screen.getByText("Online coming soon")).toBeInTheDocument();
  });

  it("switches to Nepali", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "भाषा: नेपाली" }));
    expect(screen.getByRole("heading", { name: "लुडो लाइभ" })).toBeInTheDocument();
  });

  it("starts a bot game with a fair-dice hash and a dice button", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Play vs bots/ }));
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    await userEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(await screen.findByText("Fair dice")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Tap the dice to roll" }).length).toBe(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  describe("first-run intro", () => {
    beforeEach(() => localStorage.clear());

    it("teaches in steps, then drops into a quick bot game and is not shown again", async () => {
      const { unmount } = render(<App />);
      expect(screen.getByRole("heading", { name: "Roll" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByRole("heading", { name: "Move" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByRole("heading", { name: "Capture" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByRole("heading", { name: "The dice are provably fair" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Play a quick game" }));
      expect(await screen.findByText("Fair dice")).toBeInTheDocument();
      unmount();
      render(<App />);
      expect(screen.getByRole("heading", { name: "Ludo Live" })).toBeInTheDocument();
    });

    it("can be skipped and stays skipped", async () => {
      const { unmount } = render(<App />);
      await userEvent.click(screen.getByRole("button", { name: "Skip" }));
      expect(screen.getByRole("heading", { name: "Ludo Live" })).toBeInTheDocument();
      unmount();
      render(<App />);
      expect(screen.getByRole("heading", { name: "Ludo Live" })).toBeInTheDocument();
    });
  });
});
