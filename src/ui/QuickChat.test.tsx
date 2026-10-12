import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatBubbles, QuickChat } from "./QuickChat";

describe("ChatBubbles", () => {
  const items = [{ id: 1, phraseId: "good-luck", name: "Ann" }];

  it("renders the localized phrase in a polite live region", () => {
    const { rerender } = render(<ChatBubbles lang="en" items={items} hidden={false} muted={[]} />);
    expect(screen.getByText("Good luck!")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    rerender(<ChatBubbles lang="ne" items={items} hidden={false} muted={[]} />);
    expect(screen.queryByText("Good luck!")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/\S/);
  });

  it("hides bubbles from muted players and when chat is hidden", () => {
    const { rerender } = render(<ChatBubbles lang="en" items={items} hidden={false} muted={["Ann"]} />);
    expect(screen.queryByText("Good luck!")).not.toBeInTheDocument();
    rerender(<ChatBubbles lang="en" items={items} hidden muted={[]} />);
    expect(screen.queryByText("Good luck!")).not.toBeInTheDocument();
  });
});

describe("QuickChat", () => {
  it("sends only the phrase id", async () => {
    const onSend = vi.fn();
    render(<QuickChat lang="en" onSend={onSend} hidden={false} onToggleHidden={vi.fn()} others={[]} muted={[]} onToggleMute={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Rematch?" }));
    expect(onSend).toHaveBeenCalledWith("rematch");
  });

  it("toggles mute per player and the global hide", async () => {
    const onToggleMute = vi.fn();
    const onToggleHidden = vi.fn();
    render(<QuickChat lang="en" onSend={vi.fn()} hidden={false} onToggleHidden={onToggleHidden} others={["Ann"]} muted={[]} onToggleMute={onToggleMute} />);
    await userEvent.click(screen.getByRole("button", { name: "Mute Ann" }));
    expect(onToggleMute).toHaveBeenCalledWith("Ann");
    await userEvent.click(screen.getByRole("button", { name: "Hide chat" }));
    expect(onToggleHidden).toHaveBeenCalled();
  });
});
