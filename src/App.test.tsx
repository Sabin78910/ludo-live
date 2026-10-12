import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("App", () => {
  beforeEach(() => localStorage.clear());

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
});

describe("Collection", () => {
  beforeEach(() => localStorage.clear());

  it("shows locked skins with distance, and equips an unlocked one", async () => {
    localStorage.setItem("ludo-live.progress", JSON.stringify({ games: 3, wins: 0, streak: 0, bestStreak: 0 }));
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Collection" }));
    expect(screen.getByText("Win 5 games")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Midnight: Use" }));
    expect(document.documentElement.dataset.board).toBe("midnight");
    expect(screen.getByRole("button", { name: "Midnight: In use" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(localStorage.getItem("ludo-live.equipped")!).board).toBe("midnight");
  });
});
