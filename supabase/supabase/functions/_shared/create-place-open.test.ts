import { assertEquals } from "jsr:@std/assert@1";
import { existingFromDuplicate, openedExistingPlace } from "./create-place.ts";

// Opening a Google-only result's profile is get-or-create on google_place_id
// (MESITA-2298): the consumer door never answers 409 for a place Mesita holds.

Deno.test("an existing row opens as a 200 with created: false", () => {
  const row = { id: "p1", slug: "casa", name: "Casa", state: "active" };
  const out = openedExistingPlace(row);
  assertEquals(out.ok, true);
  assertEquals(out.created, false);
  assertEquals(out.place, row);
  assertEquals(out.enrichment.enrichmentTriggered, false);
});

Deno.test("the shared core's duplicate verdict yields the row it found", () => {
  const dup = {
    ok: false as const,
    status: 409,
    body: {
      ok: false,
      code: "place_already_exists",
      error: "This place is already on Mesita.",
      existing: { id: "p1", slug: "casa", name: "Casa", state: "active" },
    },
  };
  assertEquals(existingFromDuplicate(dup), {
    id: "p1",
    slug: "casa",
    name: "Casa",
    state: "active",
  });
  assertEquals(
    existingFromDuplicate({ ok: false, status: 422, body: { code: "x" } }),
    null,
  );
  assertEquals(
    existingFromDuplicate({
      ok: false,
      status: 409,
      body: { code: "place_already_exists", existing: null },
    }),
    null,
  );
});

Deno.test("consumer-web-create-place looks the id up before the quota and never 409s a held id", async () => {
  const src = await Deno.readTextFile(
    new URL("../consumer-web-create-place/index.ts", import.meta.url),
  );
  const lookup = src.indexOf("findPlaceByGooglePlaceId(admin, googlePlaceId)");
  const gate = src.indexOf("atlasCreateOnOpenConsumer");
  const quota = src.indexOf("consumeConsumerCreateQuota(");
  // Lookup, then the operator's Create-on-open switch, then the quota: an
  // existing row opens whatever the switch says, and a switched-off open
  // spends nothing (MESITA-2298).
  assertEquals(lookup > 0 && gate > 0 && quota > 0, true);
  assertEquals(lookup < gate && gate < quota, true);
  assertEquals(src.includes('code: "create_on_open_off"'), true);
  assertEquals(src.includes("openedExistingPlace(existing)"), true);
  assertEquals(src.includes("existingFromDuplicate(created)"), true);
  assertEquals(src.includes("created: true"), true);
});
