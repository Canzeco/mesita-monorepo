// Unit tests for place tag sanitizing (no network, no DB).
//   deno test supabase/functions/_shared/tags.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import { sanitizePlaceTags } from "./tags.ts";

Deno.test("sanitizePlaceTags: keeps first exclusive pole, drops the rest", () => {
  assertEquals(
    sanitizePlaceTags(["lively", "quiet", "casual", "upscale"]),
    ["lively", "casual"],
  );
  assertEquals(
    sanitizePlaceTags(["walk_ins_welcome", "reservations_required", "accepts_reservations"]),
    ["walk_ins_welcome"],
  );
});

Deno.test("sanitizePlaceTags: idempotent on clean lists", () => {
  const clean = ["lively", "cocktails", "full_bar", "trendy"];
  assertEquals(sanitizePlaceTags(clean), clean);
  assertEquals(sanitizePlaceTags(sanitizePlaceTags(clean)), clean);
});
