import { assertEquals } from "jsr:@std/assert@1";
import { setFailure } from "./premier-set.ts";

// Each premier_set_grant refusal (migration 20261030002000) keeps its code,
// so the Multiple Places row shows it as refused, not failed (MESITA-3090).
// Manual Premier never refuses for guests (MESITA-3091).
const PLACE = "00000000-0000-4000-8000-000000003090";

Deno.test("setFailure maps every premier_set_grant refusal to its status and code", () => {
  const rows: [string, number, string][] = [
    ["premier_set_grant: archived", 409, "place_archived"],
    ["premier_set_grant: no such place", 404, "place_not_found"],
    ["premier_set_grant: tier must be 0, 1 or 2, got 3", 400, "tier_invalid"],
    ["premier_set_grant: months must be 1..12, got 13", 400, "months_invalid"],
  ];
  for (const [message, status, code] of rows) {
    const f = setFailure(message, PLACE);
    assertEquals([f.status, f.code], [status, code], message);
  }
});

Deno.test("setFailure keeps an unrelated error a 500, even when it says archived", () => {
  const f = setFailure('relation "archived_places" does not exist', PLACE);
  assertEquals(f.status, 500);
  assertEquals(f.code, "set_failed");
  assertEquals(f.error.startsWith(`Couldn't set Premier for ${PLACE}`), true);
});

Deno.test("the retired guest refusals are no longer refusals", () => {
  for (const m of ["premier_set_grant: a guest pays", "premier_set_grant: guests are waiting to pay"]) {
    assertEquals(setFailure(m, PLACE).code, "set_failed", m);
  }
});
