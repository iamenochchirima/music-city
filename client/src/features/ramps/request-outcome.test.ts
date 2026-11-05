import { expect, it } from "vitest";
import { isDefinitivelyRejectedRequest } from "./request-outcome";

it("recognizes definite client rejections but keeps timeouts and transport failures uncertain", () => {
  expect(isDefinitivelyRejectedRequest({ status: 400 })).toBe(true);
  expect(isDefinitivelyRejectedRequest({ status: 422 })).toBe(true);
  expect(isDefinitivelyRejectedRequest({ status: 401 })).toBe(false);
  expect(isDefinitivelyRejectedRequest({ status: 409 })).toBe(false);
  expect(isDefinitivelyRejectedRequest({ status: 408 })).toBe(false);
  expect(isDefinitivelyRejectedRequest({ status: 429 })).toBe(false);
  expect(isDefinitivelyRejectedRequest({})).toBe(false);
  expect(isDefinitivelyRejectedRequest(new TypeError("Network error"))).toBe(false);
});
