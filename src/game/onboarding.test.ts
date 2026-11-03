import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS, needsOnboarding, nextStep } from "./onboarding";

describe("onboarding", () => {
  it("shows only on first launch and never over a room invite", () => {
    expect(needsOnboarding(false, false)).toBe(true);
    expect(needsOnboarding(true, false)).toBe(false);
    expect(needsOnboarding(false, true)).toBe(false);
  });
  it("is at most three cards so a new player reaches a roll fast", () => {
    expect(ONBOARDING_STEPS.length).toBeLessThanOrEqual(3);
    expect(nextStep(0)).toBe(1);
    expect(nextStep(ONBOARDING_STEPS.length - 1)).toBeNull();
  });
});
