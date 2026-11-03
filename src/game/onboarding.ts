// First-run onboarding. Three short cards, always skippable, ending in a game within 30 seconds.
export const ONBOARDING_STEPS = ["welcome", "howToWin", "fairDice"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Show onboarding on the first launch only, and never in front of a friend's room invite. */
export function needsOnboarding(onboarded: boolean, joiningRoom: boolean): boolean {
  return !onboarded && !joiningRoom;
}

export function nextStep(step: number): number | null {
  return step + 1 < ONBOARDING_STEPS.length ? step + 1 : null;
}
