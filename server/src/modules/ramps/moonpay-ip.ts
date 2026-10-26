import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { HttpError } from "../../utils/http-error.js";

export function canonicalizeMoonpayIp(input: string): string {
  if (typeof input !== "string") throw invalidIp();
  let ip = input.trim();
  const bracketed = /^\[([^\]]+)\](?::(\d{1,5}))?$/.exec(ip);
  const ipv4WithPort = /^(\d+\.\d+\.\d+\.\d+):(\d{1,5})$/.exec(ip);
  const withPort = bracketed ?? ipv4WithPort;
  if (withPort) {
    if (withPort[2] && Number(withPort[2]) > 65535) throw invalidIp();
    ip = withPort[1];
  }
  if (ip.includes("%")) throw invalidIp();
  const family = isIP(ip);
  if (!family) throw invalidIp();
  if (family === 6) {
    ip = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(ip);
    if (mapped) {
      const high = Number.parseInt(mapped[1], 16);
      const low = Number.parseInt(mapped[2], 16);
      ip = [high >>> 8, high & 255, low >>> 8, low & 255].join(".");
    }
  }
  return ip;
}

function invalidIp() {
  return new HttpError(
    400,
    "Could not verify your connection. Reopen the payment.",
  );
}

// Supply addresses captured by trusted backend ingress for the device opening the widget.
// Never use a server's outbound IP, an arbitrary request body, or untrusted forwarding headers.
export function moonpayIpBinding(
  secret: string,
  customerIps: readonly string[],
): string {
  if (
    !Array.isArray(customerIps) ||
    customerIps.length < 1 ||
    customerIps.length > 2
  )
    throw invalidIp();
  const ips = customerIps.map(canonicalizeMoonpayIp);
  if (new Set(ips.map(isIP)).size !== ips.length) throw invalidIp();
  return ips
    .map((ip) => createHmac("sha256", secret).update(ip).digest("base64"))
    .join(",");
}
