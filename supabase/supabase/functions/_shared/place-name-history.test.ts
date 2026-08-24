import { assertEquals } from "jsr:@std/assert@1";
import { mergePlaceRowsById } from "./place-name-history.ts";

Deno.test("mergePlaceRowsById: history hits fill gaps the current-name ILIKE missed", () => {
  const primary = [{ id: "a", name: "New Name" }];
  const extra = [
    { id: "a", name: "New Name" },
    { id: "b", name: "Old Google Name" },
  ];
  const merged = mergePlaceRowsById(primary, extra, 8);
  assertEquals(merged.map((r) => r.id), ["a", "b"]);
});

Deno.test("mergePlaceRowsById: respects cap", () => {
  const primary = [{ id: "a" }, { id: "b" }];
  const extra = [{ id: "c" }];
  const merged = mergePlaceRowsById(primary, extra, 2);
  assertEquals(merged.map((r) => r.id), ["a", "b"]);
});
