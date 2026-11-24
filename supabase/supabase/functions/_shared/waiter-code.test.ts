// Auth (MESITA-4871): a waiter's 6-digit code and its token.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { checkWaiterToken, mintWaiterCode, mintWaiterKey, mintWaiterToken, readWaiterCode, readWaiterName, waiterOfToken } from "./waiter-code.ts";

const W = { id: "00000000-0000-4000-8000-000000004871", placeId: "00000000-0000-4000-8000-000000000001", lookupHash: "a".repeat(64) };
const NOW = 1_790_000_000_000;

Deno.test("a code is six digits", () => {
  assertEquals(readWaiterCode(" 123 456 "), "123456");
  for (const bad of ["1234", "12345", "12345a", "1234567", 123456, null]) assertEquals(readWaiterCode(bad), null);
  for (let i = 0; i < 50; i++) assert(readWaiterCode(mintWaiterCode()));
});

Deno.test("a name is one line of 1 to 40 characters", () => {
  assertEquals(readWaiterName("  Ana   Luz "), "Ana Luz");
  for (const bad of ["", "   ", "x".repeat(41), 5]) assertEquals(readWaiterName(bad), null);
});

Deno.test("a token key is 32 random bytes", () => {
  assert(/^[0-9a-f]{64}$/.test(mintWaiterKey()));
  assert(mintWaiterKey() !== mintWaiterKey());
});

Deno.test("a token is one waiter's, one place's, and ends with the code or in 12 hours", async () => {
  const t = await mintWaiterToken("key", W, NOW);
  assert(t.length <= 128, `${t.length}`);
  assertEquals(waiterOfToken(t), W.id);
  assertEquals(waiterOfToken("s2.x"), null);
  assert(await checkWaiterToken("key", W, t, NOW));
  assertEquals(await checkWaiterToken("other", W, t, NOW), null);
  assertEquals(await checkWaiterToken("key", { ...W, placeId: "00000000-0000-4000-8000-000000000002" }, t, NOW), null);
  assertEquals(await checkWaiterToken("key", { ...W, lookupHash: "b".repeat(64) }, t, NOW), null, "a new code ends it");
  assertEquals(await checkWaiterToken("key", W, t, NOW + 12 * 3600_000 + 1000), null);
  const other = "00000000-0000-4000-8000-000000004872";
  assertEquals(await checkWaiterToken("key", { ...W, id: other }, t.replace(W.id, other), NOW), null, "never another waiter's");
});
