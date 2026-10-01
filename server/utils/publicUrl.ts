// Whether a URL the server is asked to fetch (/api/browse) is on the public
// internet. The server opens it in a browser of its own, so a URL on this
// machine or its network (127.0.0.1, 192.168.x.x, a cloud metadata address)
// would read what only the server can reach: refused, by what its host name
// resolves to. CodeQL flagged the PDF reader's navigation (request forgery).
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
/* eslint-disable sonarjs/no-hardcoded-ip -- these are the ranges refused */
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}
/* eslint-enable sonarjs/no-hardcoded-ip */

// An IPv6 address's eight 16-bit groups ("::" expanded, a dotted IPv4 tail
// read as two groups), or null when it isn't one.
const ipv6Groups = (address: string): number[] | null => {
  if (isIP(address) !== 6) return null;
  let text = address;
  const last = text.lastIndexOf(":");
  const tailPart = text.slice(last + 1);
  if (tailPart.includes(".")) {
    const [a, b, c, d] = tailPart.split(".").map(Number);
    text = `${text.slice(0, last + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.split("::");
  const part = (side: string | undefined) =>
    side ? side.split(":").map((group) => parseInt(group, 16)) : [];
  const front = part(head);
  const back = part(tail);
  const zeros =
    tail === undefined ? [] : Array(8 - front.length - back.length).fill(0);
  const groups = [...front, ...zeros, ...back];
  return groups.length === 8 ? groups : null;
};

// The IPv4 address an IPv6 one carries (NAT64 64:ff9b::/96, 6to4 2002::/16,
// IPv4-compatible ::/96), checked as that IPv4 address: 64:ff9b::7f00:1 is
// 127.0.0.1 on a network with NAT64. (IPv4-mapped ::ffff:/96 BlockList
// checks as IPv4 itself.)
const embeddedIPv4 = (address: string): string | null => {
  const g = ipv6Groups(address);
  if (!g) return null;
  const quad = (hi: number, lo: number) =>
    [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => !x))
    return quad(g[6], g[7]);
  if (g[0] === 0x2002) return quad(g[1], g[2]);
  if (g.slice(0, 6).every((x) => !x) && (g[6] || g[7] > 1))
    return quad(g[6], g[7]);
  return null;
};

const isBlocked = (address: string): boolean => {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family !== 6) return true;
  const inner = embeddedIPv4(address);
  if (inner && blocked.check(inner, "ipv4")) return true;
  return blocked.check(address, "ipv6");
};

/** The URL, when it is http(s) and every address its host resolves to is
 *  public; null otherwise. */
export async function publicHttpUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host)
      ? [host]
      : (await lookup(host, { all: true })).map((entry) => entry.address);
  } catch {
    return null;
  }
  if (!addresses.length || addresses.some(isBlocked)) return null;
  return url;
}
