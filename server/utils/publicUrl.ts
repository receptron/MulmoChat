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

const isBlocked = (address: string): boolean => {
  // An IPv4 address written as IPv6 (::ffff:127.0.0.1) is the IPv4 one.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return blocked.check(mapped, "ipv4");
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) return blocked.check(address, "ipv6");
  return true;
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
