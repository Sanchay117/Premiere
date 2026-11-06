// Every submitted URL is hostile until proven otherwise. The worker only opens public
// http(s) hosts: no loopback, private, link-local, cloud metadata or other special ranges.
// The URL is checked before the browser starts, and the egress proxy repeats the check for
// every connection the page makes (redirects included).

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { normalizeUrl } from "../lib/url";

export class UnsafeUrlError extends Error {
  constructor(
    message: string,
    readonly code: "protocol" | "credentials" | "private_address" | "internal_host" | "dns",
  ) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const v4 = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, includes 169.254.169.254 cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved and broadcast
] as const) {
  v4.addSubnet(net, prefix, "ipv4");
}

const v6 = new BlockList();
for (const [net, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["64:ff9b:1::", 48], // local-use NAT64
  ["100::", 64], // discard
  ["2001::", 23], // IETF protocol assignments, includes Teredo
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["3fff::", 20], // documentation
  ["5f00::", 16], // SRv6
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast
] as const) {
  v6.addSubnet(net, prefix, "ipv6");
}

/** Expands an IPv6 address into its eight 16-bit groups. */
function ipv6Groups(address: string): number[] | null {
  let addr = address.toLowerCase();
  const zone = addr.indexOf("%");
  if (zone >= 0) addr = addr.slice(0, zone);
  const lastColon = addr.lastIndexOf(":");
  const tail = addr.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (isIP(tail) !== 4) return null;
    const [a = 0, b = 0, c = 0, d = 0] = tail.split(".").map(Number);
    addr = `${addr.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest].map((g) =>
    Number.parseInt(g, 16),
  );
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

/** IPv4 address carried inside an IPv6 one (mapped, compatible or NAT64), if any. */
function embeddedIPv4(address: string): string | null {
  const g = ipv6Groups(address);
  if (!g) return null;
  const [g0, g1, g2, g3, g4, g5, g6 = 0, g7 = 0] = g;
  const dotted = `${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`;
  const zeroTo4 = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  if (zeroTo4 && g5 === 0xffff) return dotted; // ::ffff:a.b.c.d
  if (zeroTo4 && g5 === 0 && (g6 !== 0 || g7 > 1)) return dotted; // ::a.b.c.d, but not :: or ::1
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return dotted; // NAT64
  return null;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !v4.check(address, "ipv4");
  if (family === 6) {
    const embedded = embeddedIPv4(address);
    if (embedded) return isPublicAddress(embedded);
    return !v6.check(address.toLowerCase().split("%")[0]!, "ipv6");
  }
  return false;
}

const INTERNAL_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home", ".corp", ".home.arpa"];

/** Resolves a hostname and returns its addresses, throwing unless every one of them is public. */
export async function resolvePublicHost(hostname: string): Promise<string[]> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new UnsafeUrlError("That link points to a private network address.", "private_address");
    return [host];
  }
  if (!host.includes(".") || host === "localhost" || INTERNAL_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError("That link points to an internal host.", "internal_host");
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError(`Could not find ${host}. Check the link and try again.`, "dns");
  }
  if (addresses.length === 0) throw new UnsafeUrlError(`Could not find ${host}.`, "dns");
  if (addresses.some((a) => !isPublicAddress(a.address))) {
    throw new UnsafeUrlError("That link points to a private network address.", "private_address");
  }
  return addresses.map((a) => a.address);
}

export async function assertPublicHost(hostname: string): Promise<void> {
  await resolvePublicHost(hostname);
}

/** Validates a user-submitted URL. Returns the normalized URL when it is safe to open. */
export async function assertPublicUrl(input: string | URL): Promise<URL> {
  const url = typeof input === "string" ? normalizeUrl(input) : input;
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https links are supported.", "protocol");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("Links with a username or password in them are not supported.", "credentials");
  }
  await assertPublicHost(url.hostname);
  return url;
}
