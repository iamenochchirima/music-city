import type { OnboardingStep, PrimaryIntent } from "./auth.js";

export function onboardingSteps(intent: PrimaryIntent): OnboardingStep[] {
  return [
    "identity",
    "intent",
    ...(intent !== "listener"
      ? (["artist_activation", "artist_identity"] as const)
      : []),
    "visuals",
    "personalize",
    "complete",
  ];
}

export function nextOnboardingStep(
  intent: PrimaryIntent,
  step: OnboardingStep,
): OnboardingStep {
  const steps = onboardingSteps(intent);
  return steps[steps.indexOf(step) + 1] ?? "complete";
}
