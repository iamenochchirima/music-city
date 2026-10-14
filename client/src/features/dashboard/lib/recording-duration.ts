export function recordingDuration(runtime: string) {
  return /^(?:\d+:)?\d+:[0-5]\d$/.test(runtime) ? runtime : undefined;
}
