import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { canonicalizeMoonpayIp, moonpayIpBinding } from "./moonpay-ip.js";

const secret = "sk_test_fixture";
const hash = (ip: string) =>
  createHmac("sha256", secret).update(ip).digest("base64");

test("MoonPay IP binding canonicalizes IPv6 and unmapped IPv4 before hashing", () => {
  for (const [input, expected] of [
    ["203.0.113.42", "203.0.113.42"],
    ["203.0.113.42:443", "203.0.113.42"],
    ["2001:0DB8:0000:0000:0000:0000:0000:0001", "2001:db8::1"],
    ["[2001:db8::1]:443", "2001:db8::1"],
    ["::ffff:203.0.113.42", "203.0.113.42"],
    ["::ffff:cb00:712a", "203.0.113.42"],
  ]) {
    assert.equal(canonicalizeMoonpayIp(input), expected);
    assert.equal(moonpayIpBinding(secret, [input]), hash(expected));
  }
});

test("MoonPay IP binding accepts one address per family for a dual-stack device", () => {
  assert.equal(
    moonpayIpBinding(secret, ["203.0.113.42", "2001:db8::1"]),
    [hash("203.0.113.42"), hash("2001:db8::1")].join(","),
  );
});

test("MoonPay IP binding rejects absent, malformed and ambiguous addresses", () => {
  for (const ips of [
    undefined,
    [],
    [""],
    ["localhost"],
    ["203.000.113.42"],
    ["203.0.113.42,198.51.100.1"],
    ["203.0.113.42:99999"],
    ["[2001:db8::1]:99999"],
    ["fe80::1%eth0"],
    ["203.0.113.42", "203.0.113.43"],
    ["203.0.113.42", "::ffff:203.0.113.42"],
    ["203.0.113.42", "2001:db8::1", "2001:db8::2"],
  ]) {
    assert.throws(
      () => moonpayIpBinding(secret, ips as string[]),
      /verify your connection/,
    );
  }
});
