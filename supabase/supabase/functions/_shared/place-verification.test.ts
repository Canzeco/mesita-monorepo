// Who runs a place (MESITA-3103): the phone proof and the access rule.
import { assertEquals } from "jsr:@std/assert@1";
import { boundedText, maskPhone } from "./place-verification.ts";
import { isLiveManager } from "./place-access.ts";

Deno.test("the listing phone is masked before any proof", () => {
  assertEquals(maskPhone("+52 81 1234 5678"), "+52 ••• ••• 56 78");
  assertEquals(maskPhone("81 1234 5678"), "••• ••• 56 78");
  assertEquals(maskPhone(null), null);
});

Deno.test("a row grants the place only while live", () => {
  const now = Date.parse("2026-11-01T00:00:00Z");
  assertEquals(isLiveManager({ revoked_at: null, expires_at: "2027-11-01T00:00:00Z" }, now), true);
  assertEquals(isLiveManager({ revoked_at: null, expires_at: "2026-10-01T00:00:00Z" }, now), false);
  assertEquals(isLiveManager({ revoked_at: "2026-10-31T00:00:00Z", expires_at: "2027-11-01T00:00:00Z" }, now), false);
  assertEquals(isLiveManager(null, now), false);
});

Deno.test("request text is trimmed and bounded", () => {
  assertEquals(boundedText("  Ana  ", 80), "Ana");
  assertEquals(boundedText("", 80), null);
  assertEquals(boundedText("x".repeat(81), 80), undefined);
  assertEquals(boundedText(4, 80), undefined);
});
