export const releaseSteps = [
  { id: "music", label: "Add music" },
  { id: "information", label: "Song details" },
  { id: "artwork", label: "Release details" },
  { id: "review", label: "Review & publish" },
] as const;
export type ReleaseStep = (typeof releaseSteps)[number]["id"];
