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

  it("names the chest button with the visible spark count", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Daily chest: 0" })).toBeInTheDocument();
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

  it("keeps the lobby hero to the title and Play now, without feature chips", () => {
    const { container } = render(<App />);
    const hero = container.querySelector(".hero-card") as HTMLElement;
    expect(hero).toHaveTextContent("Play now");
    expect(hero).not.toHaveTextContent("Fair dice");
    expect(hero).not.toHaveTextContent("No ads during matches");
  });

  it("starts a game straight from Play now", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Play now" }));
    expect(await screen.findAllByRole("button", { name: "Tap the dice to roll" })).toHaveLength(1);
  });

  it("keeps sound and accessibility options in a settings sheet", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    const sound = screen.getByRole("switch", { name: "Sound" });
    expect(sound).toBeChecked();
    await userEvent.click(sound);
    expect(sound).not.toBeChecked();
    expect(JSON.parse(localStorage.getItem("ludo-live.settings")!).sound).toBe(false);
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

  it("opens Snakes & Ladders from the lobby and starts a game vs the computer", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Snakes & Ladders/ }));
    expect(screen.getByRole("button", { name: "Computer" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    await userEvent.click(screen.getByRole("button", { name: "Start game" }));
    expect(screen.getByRole("img", { name: "Snakes & Ladders" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Tap the dice to roll" })).toBeInTheDocument();
  });
});
