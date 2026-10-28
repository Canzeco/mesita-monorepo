// buildPlaceUpdate is the whitelist between an operator's save and the
// profile row (MESITA-2982). What it guards is data loss: a key the body
// never sent must not be written, a blank must clear rather than store "",
// and a refused field must stop the whole save instead of half-writing it.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildPlaceUpdate, type UpdateBody } from "./build-update.ts";

const FAMILIES = [
  { slug: "coffee", label: "Coffee", emoji: "☕", sort_order: 1 },
  { slug: "tacos", label: "Tacos", emoji: "🌮", sort_order: 7 },
];

async function refused(body: UpdateBody, families = FAMILIES) {
  const r = buildPlaceUpdate(body, families);
  assert(!r.ok, "expected a refusal");
  return { status: r.response.status, body: await r.response.json() };
}

Deno.test("only the keys the body sent reach the patch", () => {
  const r = buildPlaceUpdate({ id: "p1", description: "  A café.  " }, FAMILIES);
  assert(r.ok);
  assertEquals(r.update, { description: "A café." });
  assertEquals(r.familyKeys, undefined);
  assertEquals(r.resetFields, []);
});

Deno.test("a blank name, link or Presentation clears the field", () => {
  const r = buildPlaceUpdate(
    { id: "p1", name: "   ", website_url: " ", instagram_url: null, description: null },
    FAMILIES,
  );
  assert(r.ok);
  assertEquals(r.update, {
    name: null,
    website_url: null,
    instagram_url: null,
    description: null,
  });
});

Deno.test("tags are trimmed and deduplicated; families are validated against the vocabulary", () => {
  const r = buildPlaceUpdate(
    { id: "p1", tags: [" patio", "patio", ""], family_keys: ["tacos", "coffee"] },
    FAMILIES,
  );
  assert(r.ok);
  assertEquals(r.update, { tags: ["patio"] });
  assertEquals(r.familyKeys, ["coffee", "tacos"]);
});

Deno.test("a Reset may ride alone, with no edit", () => {
  const r = buildPlaceUpdate({ id: "p1", reset_fields: ["name", "tags"] }, FAMILIES);
  assert(r.ok);
  assertEquals(r.update, {});
  assertEquals(r.resetFields, ["name", "tags"]);
});

Deno.test("a body with nothing editable is a 400", async () => {
  assertEquals(await refused({ id: "p1" }), {
    status: 400,
    body: { ok: false, error: "No editable fields provided" },
  });
});

Deno.test("one bad field refuses the whole save", async () => {
  assertEquals(
    (await refused({ id: "p1", description: "ok", website_url: "http://x.com" })).body.error,
    "website_url must be a valid https:// URL",
  );
  assertEquals(
    (await refused({ id: "p1", phone: "81 8378 2164" })).body.code,
    "phone_needs_country_code",
  );
  assertEquals(
    (await refused({ id: "p1", reservations_enabled: true, reservation_channel: "none" })).status,
    400,
  );
  assertEquals((await refused({ id: "p1", reset_fields: ["hours"] })).status, 400);
});

Deno.test("families with no vocabulary loaded is a 500, never a clear", async () => {
  assertEquals(await refused({ id: "p1", family_keys: ["tacos"] }, []), {
    status: 500,
    body: { ok: false, error: "Family vocabulary unavailable" },
  });
});
