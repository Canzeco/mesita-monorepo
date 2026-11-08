// MESITA-3405: the Send SMS hook trusts only Supabase Auth's signature (auth).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { signInPhone, verifyHookSignature } from "./sign-in-code.ts";
import { callTwiml } from "./place-call-code.ts";

const KEY = btoa("a-thirty-two-byte-test-key-12345");
const SECRET = `v1,whsec_${KEY}`;

async function sign(id: string, ts: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(KEY), (c) => c.charCodeAt(0)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

function headers(id: string, ts: string, sig: string): Headers {
  return new Headers({ "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": sig });
}

Deno.test("a correctly signed, fresh hook call passes", async () => {
  const body = '{"user":{"phone":"528125680835"},"sms":{"otp":"123456"}}';
  const now = 1_800_000_000;
  const sig = await sign("msg_1", String(now), body);
  assert(await verifyHookSignature(SECRET, headers("msg_1", String(now), `v1,${sig}`), body, now));
  assert(await verifyHookSignature(SECRET, headers("msg_1", String(now), `v1,bogus v1,${sig}`), body, now));
});

Deno.test("a forged, altered or stale hook call fails", async () => {
  const body = '{"user":{"phone":"528125680835"},"sms":{"otp":"123456"}}';
  const now = 1_800_000_000;
  const sig = await sign("msg_1", String(now), body);
  assertEquals(await verifyHookSignature(SECRET, headers("msg_1", String(now), `v1,${sig}`), body.replace("123456", "000000"), now), false);
  assertEquals(await verifyHookSignature(`v1,whsec_${btoa("another-key-another-key-another!")}`, headers("msg_1", String(now), `v1,${sig}`), body, now), false);
  assertEquals(await verifyHookSignature(SECRET, headers("msg_1", String(now), `v1,${sig}`), body, now + 301), false);
  assertEquals(await verifyHookSignature(SECRET, new Headers(), body, now), false);
});

Deno.test("Auth's digits and the browser's E.164 are the same phone", () => {
  assertEquals(signInPhone("528125680835"), "+528125680835");
  assertEquals(signInPhone("+52 81 2568 0835"), "+528125680835");
  assertEquals(signInPhone("123"), null);
  assertEquals(signInPhone(null), null);
});

Deno.test("the sign-in call says a sign-in code, not a claim", () => {
  const es = callTwiml("048213", "+525512345678", "sign_in");
  assert(es.includes("para entrar"));
  assertEquals(es.split("0. 4. 8. 2. 1. 3").length - 1, 2);
  assert(callTwiml("048213", "+525512345678").includes("reclamar"));
});
