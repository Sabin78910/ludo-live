import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Results } from "./Results";

const base = { lang: "en" as const, title: "You win!", order: [{ name: "You", color: "red" as const }], onHome() {}, onVerify() {} };

describe("results reward", () => {
  it("shows the sparks earned by the game", () => {
    render(<Results {...base} reduced sparks={25} />);
    expect(screen.getByRole("status", { name: "You earned 25 sparks" })).toHaveTextContent("+25");
  });

  it("shows nothing when the game earned no sparks", () => {
    render(<Results {...base} reduced />);
    expect(screen.queryByRole("status", { name: /sparks/ })).toBeNull();
  });
});
