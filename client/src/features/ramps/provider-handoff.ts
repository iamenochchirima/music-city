import {
  rampSandboxLaunchTargets,
  type RampDirection,
  type RampProvider,
} from "@music-city/shared";

const providerNames: Record<RampProvider, string> = {
  moonpay: "MoonPay",
  moneygram: "MoneyGram",
};

export function rampProviderName(provider: RampProvider) {
  return providerNames[provider];
}

export function validateRampProviderUrl(
  provider: RampProvider,
  direction: RampDirection,
  rawUrl: string,
) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid provider destination");
  }

  const target = rampSandboxLaunchTargets[provider][direction];
  const supportedPath = provider === "moneygram"
    ? [target.pathname, "/widget.html"].includes(url.pathname)
    : url.pathname === target.pathname;
  if (
    url.protocol !== "https:" ||
    url.origin !== target.origin ||
    !supportedPath ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error("Invalid provider destination");
  }

  return url.href;
}
