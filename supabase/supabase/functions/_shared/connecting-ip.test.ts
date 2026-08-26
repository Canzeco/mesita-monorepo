import { assertEquals } from "jsr:@std/assert@1";
import {
  connectingIp,
  hashConnectingIp,
  parseIp,
} from "./connecting-ip.ts";

Deno.test("parseIp: v4, v4:port, v6, junk", () => {
  assertEquals(parseIp("203.0.113.10"), "203.0.113.10");
  assertEquals(parseIp("203.0.113.10:443"), "203.0.113.10");
  assertEquals(parseIp("2001:db8::1"), "2001:db8::1");
  assertEquals(parseIp("[2001:db8::1]:443"), "2001:db8::1");
  assertEquals(parseIp("not-an-ip"), null);
  assertEquals(parseIp("999.1.1.1"), null);
  assertEquals(parseIp(""), null);
});

Deno.test("connectingIp: rightmost XFF, not the spoofed leftmost hop", () => {
  const req = new Request("https://example.test", {
    headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.9, 203.0.113.10" },
  });
  assertEquals(connectingIp(req), "203.0.113.10");
});

Deno.test("connectingIp: CF-Connecting-IP wins over a spoofed XFF chain", () => {
  const req = new Request("https://example.test", {
    headers: {
      "cf-connecting-ip": "203.0.113.50",
      "x-forwarded-for": "198.51.100.1, 203.0.113.50, 10.0.0.1",
    },
  });
  assertEquals(connectingIp(req), "203.0.113.50");
});

Deno.test("connectingIp: True-Client-IP and X-Real-IP do not override XFF", () => {
  const req = new Request("https://example.test", {
    headers: {
      "true-client-ip": "198.51.100.1",
      "x-real-ip": "198.51.100.2",
      "x-forwarded-for": "198.51.100.1, 203.0.113.10",
    },
  });
  assertEquals(connectingIp(req), "203.0.113.10");
});

Deno.test("connectingIp: True-Client-IP or X-Real-IP alone is not an identity", () => {
  const a = new Request("https://example.test", {
    headers: { "true-client-ip": "203.0.113.77" },
  });
  const b = new Request("https://example.test", {
    headers: { "x-real-ip": "203.0.113.77" },
  });
  assertEquals(connectingIp(a), null);
  assertEquals(connectingIp(b), null);
});

Deno.test("connectingIp: no headers is null", () => {
  assertEquals(connectingIp(new Request("https://example.test")), null);
});

Deno.test("hashConnectingIp: rotating leftmost XFF does not mint a new hash", async () => {
  const a = new Request("https://example.test", {
    headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.10" },
  });
  const b = new Request("https://example.test", {
    headers: { "x-forwarded-for": "198.51.100.99, 203.0.113.10" },
  });
  const ha = await hashConnectingIp(a, "salt");
  const hb = await hashConnectingIp(b, "salt");
  assertEquals(ha, hb);
  const c = new Request("https://example.test", {
    headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.11" },
  });
  const hc = await hashConnectingIp(c, "salt");
  if (ha === null || hc === null) throw new Error("expected hashes");
  assertEquals(ha === hc, false);
});
