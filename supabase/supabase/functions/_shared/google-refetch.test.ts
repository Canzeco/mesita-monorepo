import { assertEquals } from "jsr:@std/assert@1";
import { refetchOutcome, refetchPatch, type RefetchRow } from "./google-refetch.ts";
import type { FieldPins } from "./enrich-corrections.ts";

const NOW = "2026-10-19T00:00:00.000Z";
const ROW: RefetchRow = {
  phone: "+52 55 1111 1111",
  reservation_channel: null,
  reservation_target: null,
  enrichment_sources: {},
};
const PHONE_PIN: FieldPins = {
  phone: { source: "business", confidence: 1, pinnedUntil: "2027-01-01T00:00:00.000Z" },
};

Deno.test("a different Google phone replaces the stored one; liveness is recorded", () => {
  const out = refetchPatch({
    row: ROW,
    googlePhone: "+52 55 2222 2222",
    businessStatus: "OPERATIONAL",
    now: NOW,
    pins: {},
  });
  assertEquals(out.patch, {
    business_state: "OPERATIONAL",
    business_state_at: NOW,
    phone: "+52 55 2222 2222",
  });
  assertEquals(out.phoneChanged, true);
});

Deno.test("the same number in another format is not a change", () => {
  const out = refetchPatch({
    row: ROW,
    googlePhone: "+525511111111",
    businessStatus: null,
    now: NOW,
    pins: {},
  });
  assertEquals(out.patch, {});
  assertEquals(out.phoneChanged, false);
});

Deno.test("a pinned phone is withheld and named", () => {
  const out = refetchPatch({
    row: ROW,
    googlePhone: "+52 55 2222 2222",
    businessStatus: "OPERATIONAL",
    now: NOW,
    pins: PHONE_PIN,
  });
  assertEquals("phone" in out.patch, false);
  assertEquals(out.pinned, ["phone"]);
  assertEquals(out.phoneChanged, false);
  assertEquals(out.patch.business_state, "OPERATIONAL");
});

Deno.test("an expired pin is not a pin", () => {
  const out = refetchPatch({
    row: ROW,
    googlePhone: "+52 55 2222 2222",
    businessStatus: null,
    now: NOW,
    pins: { phone: { source: "business", confidence: 1, pinnedUntil: "2026-01-01T00:00:00.000Z" } },
  });
  assertEquals(out.patch.phone, "+52 55 2222 2222");
});

Deno.test("a phone endpoint that held the old number moves with it; an operator's other number stays", () => {
  const copied = refetchPatch({
    row: { ...ROW, reservation_channel: "phone", reservation_target: "+525511111111" },
    googlePhone: "+52 55 2222 2222",
    businessStatus: null,
    now: NOW,
    pins: {},
  });
  assertEquals(copied.patch.reservation_target, "+52 55 2222 2222");
  const own = refetchPatch({
    row: { ...ROW, reservation_channel: "phone", reservation_target: "+52 55 3333 3333" },
    googlePhone: "+52 55 2222 2222",
    businessStatus: null,
    now: NOW,
    pins: {},
  });
  assertEquals("reservation_target" in own.patch, false);
});

Deno.test("Google with no phone leaves the stored one; an unknown status is not written", () => {
  const out = refetchPatch({
    row: ROW,
    googlePhone: null,
    businessStatus: "SOMETHING_NEW",
    now: NOW,
    pins: {},
  });
  assertEquals(out.patch, {});
});

Deno.test("step 1 fails only on a permanently closed listing; absence and a kept pin are results", () => {
  assertEquals(
    refetchOutcome({ businessStatus: "CLOSED_PERMANENTLY", phoneChanged: false, pinned: [], googleHasPhone: true }).state,
    "failed",
  );
  assertEquals(
    refetchOutcome({ businessStatus: "OPERATIONAL", phoneChanged: true, pinned: [], googleHasPhone: true }).state,
    "completed",
  );
  assertEquals(
    refetchOutcome({ businessStatus: null, phoneChanged: false, pinned: ["phone"], googleHasPhone: true }).state,
    "completed",
  );
  assertEquals(
    refetchOutcome({ businessStatus: null, phoneChanged: false, pinned: [], googleHasPhone: false }).detail,
    "Google refetched after a wrong number; Google lists no phone.",
  );
});

Deno.test("the refetch never stamps enriched_at and never marks the place enriching", async () => {
  const src = await Deno.readTextFile(new URL("./google-refetch.ts", import.meta.url));
  const code = src.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
  assertEquals(/enriched_at\s*:/.test(code), false);
  assertEquals(/content_state\s*:/.test(code), false);
});
