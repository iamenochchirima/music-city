import { track } from "@vercel/analytics";

/**
 * Sends product-level events without including names, emails, wallet addresses,
 * or other personally identifiable visitor data.
 */
export const trackEvent = (eventName: string) => {
  track(eventName);
};
