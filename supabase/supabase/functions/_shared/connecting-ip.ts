// Connecting IP for public EF ledgers (quota, ticket-check rate limits).
//
// Leftmost X-Forwarded-For is the client-supplied hop — anyone with the
// published anon key can rotate it per request. Cloudflare overwrites
// CF-Connecting-IP; Kong/Deno append the TCP peer at the right of XFF.
// Prefer those. Missing IP → null (callers fail-closed on billed spend).

const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:.]+$/;

export function parseIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s || s.length > 45) return null;
  if (s.startsWith("[")) {
    const end = s.indexOf("]");
    if (end < 0) return null;
    s = s.slice(1, end);
  } else {
    const v4port = s.match(/^((?:\d{1,3}\.){3}\d{1,3}):\d+$/);
    if (v4port) s = v4port[1];
  }
  if (IPV4.test(s)) return s;
  if (s.includes(":") && IPV6.test(s)) return s;
  return null;
}

/** Visitor IP for hashing. Not the leftmost XFF hop. */
export function connectingIp(req: Request): string | null {
  const cf = parseIp(req.headers.get("cf-connecting-ip"));
  if (cf) return cf;
  const trueClient = parseIp(req.headers.get("true-client-ip"));
  if (trueClient) return trueClient;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
      const ip = parseIp(hops[i]);
      if (ip) return ip;
    }
  }
  return parseIp(req.headers.get("x-real-ip"));
}

export async function hashConnectingIp(
  req: Request,
  salt: string,
): Promise<string | null> {
  const ip = connectingIp(req);
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${ip}|${day}|${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
