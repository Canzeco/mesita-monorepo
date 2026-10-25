import { assertEquals } from "jsr:@std/assert@1";
import { isSelectedRow } from "./selected-row.ts";

Deno.test("isSelectedRow is true only when places.selected is true", () => {
  assertEquals(isSelectedRow({ selected: true }), true);
  assertEquals(isSelectedRow({ selected: false }), false);
  assertEquals(isSelectedRow({ selected: null }), false);
  assertEquals(isSelectedRow({}), false);
});
