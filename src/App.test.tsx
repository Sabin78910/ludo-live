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

  it("opens a tournament bracket with two semis and an unseeded final", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Pass & play/ }));
    await userEvent.click(screen.getByRole("button", { name: /Tournament/ }));
    expect(screen.getByRole("region", { name: "Semi-final 1" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Semi-final 2" })).toBeInTheDocument();
    expect(screen.getByText("Waiting for the semi-finals")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Play Semi-final 1" }));
    expect(await screen.findByText("Fair dice")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});
