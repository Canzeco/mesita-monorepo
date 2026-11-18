// MESITA-4390 — a gift link's key, sealed so its sender can see it again.
// Money: a sealed key must open only under the same secret, and a tampered
// or foreign seal must open to nothing, never to a wrong key.

import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { openGiftToken, sealGiftToken } from "./gift-seal.ts";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";

Deno.test("gift seal: opens back to the same key under the same secret", async () => {
  const sealed = await sealGiftToken(TOKEN, "secret-a");
  assertEquals(await openGiftToken(sealed, "secret-a"), TOKEN);
});

Deno.test("gift seal: never stores the key in clear, and two seals differ", async () => {
  const a = await sealGiftToken(TOKEN, "secret-a");
  const b = await sealGiftToken(TOKEN, "secret-a");
  assertEquals(a.includes(TOKEN), false);
  assertNotEquals(a, b);
});

Deno.test("gift seal: another secret, a tampered seal or no seal opens to null", async () => {
  const sealed = await sealGiftToken(TOKEN, "secret-a");
  assertEquals(await openGiftToken(sealed, "secret-b"), null);
  const flipped = sealed.slice(0, -2) + (sealed.endsWith("AA") ? "BB" : "AA");
  assertEquals(await openGiftToken(flipped, "secret-a"), null);
  assertEquals(await openGiftToken(null, "secret-a"), null);
  assertEquals(await openGiftToken("v1.", "secret-a"), null);
  assertEquals(await openGiftToken("garbage", "secret-a"), null);
});
