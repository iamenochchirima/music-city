export const releaseSteps = [
  { id: "basics", label: "Release basics" },
  { id: "music", label: "Add music" },
  { id: "information", label: "Track information" },
  { id: "artwork", label: "Artwork & release details" },
  { id: "review", label: "Review & publish" },
] as const;
export type ReleaseStep = (typeof releaseSteps)[number]["id"];
