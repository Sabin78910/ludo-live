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

  it("shows the current language in its own script and switches to Nepali", async () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Language: English/ })).toHaveTextContent("English");
    await userEvent.click(screen.getByRole("button", { name: /Language: English/ }));
    expect(screen.getByRole("heading", { name: "लुडो लाइभ" })).toBeInTheDocument();
  });

  it("cycles the theme and applies it to the document", async () => {
    render(<App />);
    expect(document.documentElement.dataset.theme).toBeUndefined();
    await userEvent.click(screen.getByRole("button", { name: /Theme: Auto/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await userEvent.click(screen.getByRole("button", { name: /Theme: Light/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await userEvent.click(screen.getByRole("button", { name: /Theme: Dark/ }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("shows a board preview on the home screen", () => {
    const { container } = render(<App />);
    expect(container.querySelector(".hero-board .board")).not.toBeNull();
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
