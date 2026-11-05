import { expect, it } from "vitest";
import { rampProviderName, validateRampProviderUrl } from "./provider-handoff";

it("validates exact sandbox launch targets for each provider and direction", () => {
  expect(
    validateRampProviderUrl(
      "moonpay",
      "buy",
      "https://buy-sandbox.moonpay.com/?signature=test",
    ),
  ).toBe("https://buy-sandbox.moonpay.com/?signature=test");
  expect(
    validateRampProviderUrl(
      "moneygram",
      "sell",
      "https://playground.xramps.moneygram.com/sdk/widget.html?mode=off-ramp",
    ),
  ).toBe(
    "https://playground.xramps.moneygram.com/sdk/widget.html?mode=off-ramp",
  );
  expect(validateRampProviderUrl("moneygram", "buy", "https://playground.xramps.moneygram.com/widget.html?mode=on-ramp"))
    .toBe("https://playground.xramps.moneygram.com/widget.html?mode=on-ramp");
  expect(rampProviderName("moneygram")).toBe("MoneyGram");
});

it("rejects lookalike hosts, unexpected paths, credentials, fragments, and HTTP", () => {
  for (const url of [
    "https://playground.xramps.moneygram.com.evil.test/widget.html",
    "https://playground.xramps.moneygram.com/other",
    "https://user@playground.xramps.moneygram.com/widget.html",
    "https://playground.xramps.moneygram.com/widget.html#redirect",
    "http://playground.xramps.moneygram.com/widget.html",
  ]) {
    expect(() => validateRampProviderUrl("moneygram", "buy", url)).toThrow(
      "Invalid provider destination",
    );
  }
});
