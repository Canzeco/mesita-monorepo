// MESITA-3127: the claim call is proof that you run a place (auth).
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { callTwiml, hashCode, newCode, toE164 } from "./place-call-code.ts";

Deno.test("a code is six digits", () => {
  for (let i = 0; i < 200; i++) assert(/^\d{6}$/.test(newCode()));
});

Deno.test("the hash is bound to the place and the guest", async () => {
  const a = await hashCode("p1", "g1", "123456");
  assertEquals(a.length, 64);
  assertEquals(a, await hashCode("p1", "g1", "123456"));
  assertNotEquals(a, await hashCode("p2", "g1", "123456"));
  assertNotEquals(a, await hashCode("p1", "g2", "123456"));
});

Deno.test("only an international listing phone is dialed", () => {
  assertEquals(toE164("+52 55 1234 5678"), "+525512345678");
  assertEquals(toE164("55 1234 5678"), null);
  assertEquals(toE164(null), null);
});

Deno.test("the call says the code twice, in Spanish for Mexico", () => {
  const es = callTwiml("048213", "+525512345678");
  assertEquals(es.split("0. 4. 8. 2. 1. 3").length - 1, 2);
  assert(es.includes('language="es-MX"'));
  assert(callTwiml("048213", "+14155550100").includes('language="en-US"'));
});
