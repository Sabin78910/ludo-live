import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ludo-live.settings", JSON.stringify({ onboarded: true }));
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

  it("opens the fairness explainer from the in-game chip", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Play vs bots/ }));
    await userEvent.click(screen.getByRole("button", { name: "Start game" }));
    await userEvent.click(await screen.findByRole("button", { name: /Fair dice/ }));
    expect(screen.getByRole("dialog", { name: "How the dice stay fair" })).toBeInTheDocument();
  });
});

describe("first-run onboarding", () => {
  beforeEach(() => localStorage.clear());

  it("reaches a game in three taps and is not shown again", async () => {
    const { unmount } = render(<App />);
    expect(screen.getByRole("dialog", { name: "Welcome to Ludo Live" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Play your first game" }));
    expect(await screen.findAllByRole("button", { name: "Tap the dice to roll" })).toHaveLength(1);
    unmount();
    render(<App />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("can be skipped from the first card", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Play vs bots/ })).toBeInTheDocument();
  });
});
