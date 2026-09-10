import { assertEquals } from "jsr:@std/assert";
import { chunked, ID_CHUNK, one } from "./postgrest.ts";

Deno.test("one: a bare object passes through", () => {
  assertEquals(one({ id: "a" }), { id: "a" });
});

Deno.test("one: an array yields its first element", () => {
  assertEquals(one([{ id: "a" }, { id: "b" }]), { id: "a" });
});

Deno.test("one: an EMPTY array is null, not undefined", () => {
  // supabase-js reports a to-one embed with no match as [] in the array-typed
  // shape and null in the other; both have to reach callers as the same null.
  assertEquals(one([]), null);
  assertEquals(one(null), null);
  assertEquals(one(undefined), null);
});

Deno.test("chunked: an empty list yields NO chunks", () => {
  // The load-bearing case: a caller looping over this issues zero queries
  // rather than one `.in()` with an empty filter.
  assertEquals(chunked([], ID_CHUNK), []);
});

Deno.test("chunked: a short list is one chunk", () => {
  assertEquals(chunked([1, 2, 3], ID_CHUNK), [[1, 2, 3]]);
});

Deno.test("chunked: splits on the boundary and keeps order", () => {
  assertEquals(chunked([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assertEquals(chunked([1, 2, 3, 4], 2), [[1, 2], [3, 4]]); // exact fit: no trailing []
});

Deno.test("chunked: every element survives exactly once at the real chunk size", () => {
  const ids = Array.from({ length: ID_CHUNK * 2 + 1 }, (_, i) => i);
  const out = chunked(ids, ID_CHUNK);
  assertEquals(out.length, 3);
  assertEquals(out.flat(), ids);
});
