import { assertEquals } from "jsr:@std/assert@1";
import { createTtlCache } from "./memo-cache.ts";

// The cache sits on Memo's synchronous chat path, and its failure modes are all
// silent: a stale persona after an operator saves, personalisation muted by a
// cached miss, or unbounded growth in a warm isolate. Pin each one.

Deno.test("ttl cache: returns a live value within the TTL", () => {
  const cache = createTtlCache<string>();
  cache.set("k", "v", 1000);
  const got = cache.get("k", 1000);
  assertEquals(got.hit, true);
  assertEquals(got.hit && got.value, "v");
});

Deno.test("ttl cache: misses an unknown key", () => {
  const cache = createTtlCache<string>();
  assertEquals(cache.get("nope", 1000).hit, false);
});

Deno.test("ttl cache: expires and reaps the entry", async () => {
  const cache = createTtlCache<string>();
  cache.set("k", "v", 10);
  assertEquals(cache.get("k", 10).hit, true);
  await new Promise((r) => setTimeout(r, 25));
  assertEquals(cache.get("k", 10).hit, false);
  // The expired read should have dropped it, not just reported a miss.
  assertEquals(cache.size(), 0);
});

// ttlMs <= 0 is how a caller opts out entirely — this is what keeps the admin
// Playground reading the persona you just saved.
Deno.test("ttl cache: ttl 0 disables both get and set", () => {
  const cache = createTtlCache<string>();
  cache.set("k", "v", 0);
  assertEquals(cache.size(), 0);

  cache.set("k", "v", 1000);
  assertEquals(cache.get("k", 0).hit, false);
});

Deno.test("ttl cache: caches a null value distinctly from a miss", () => {
  const cache = createTtlCache<string | null>();
  cache.set("k", null, 1000);
  const got = cache.get("k", 1000);
  assertEquals(got.hit, true);
  assertEquals(got.hit && got.value, null);
});

Deno.test("ttl cache: evicts oldest first past maxEntries", () => {
  const cache = createTtlCache<string>(2);
  cache.set("a", "1", 1000);
  cache.set("b", "2", 1000);
  cache.set("c", "3", 1000);

  assertEquals(cache.size(), 2);
  assertEquals(cache.get("a", 1000).hit, false); // oldest, evicted
  assertEquals(cache.get("b", 1000).hit, true);
  assertEquals(cache.get("c", 1000).hit, true);
});

// Re-setting a hot key must move it to the BACK of the eviction queue. Get this
// backwards and the most-used entry is the first one thrown away.
Deno.test("ttl cache: re-setting a key refreshes its eviction position", () => {
  const cache = createTtlCache<string>(2);
  cache.set("a", "1", 1000);
  cache.set("b", "2", 1000);
  cache.set("a", "1-again", 1000); // 'a' is now newest, 'b' oldest
  cache.set("c", "3", 1000);

  assertEquals(cache.size(), 2);
  assertEquals(cache.get("b", 1000).hit, false); // oldest, evicted
  const a = cache.get("a", 1000);
  assertEquals(a.hit, true);
  assertEquals(a.hit && a.value, "1-again");
  assertEquals(cache.get("c", 1000).hit, true);
});

Deno.test("ttl cache: entries are independent per key", () => {
  const cache = createTtlCache<string>();
  cache.set("a", "1", 1000);
  cache.set("b", "2", 1000);
  const a = cache.get("a", 1000);
  const b = cache.get("b", 1000);
  assertEquals(a.hit && a.value, "1");
  assertEquals(b.hit && b.value, "2");
});
