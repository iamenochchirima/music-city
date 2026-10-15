export const releaseSteps = [
  { id: "basics", label: "Release setup" },
  { id: "music", label: "Add music" },
  { id: "information", label: "Song details" },
  { id: "artwork", label: "Artwork & details" },
  { id: "review", label: "Review & publish" },
] as const;
export type ReleaseStep = (typeof releaseSteps)[number]["id"];
