// Guard tests for the place aggregate validator + write door (MESITA-1279).
//
// Run: deno test supabase/functions/_shared/place-doc.test.ts
//
// Three groups:
//   1. validatePlaceProfilePatch / validatePlacePatch / validateProfilePatch
//      accept/reject — belt 2, exercised against the invariants documented
//      in place-doc.ts (each traced to a live CHECK constraint or enum).
//   2. writePlace — proves the write door actually GATES: an invalid patch
//      never reaches the mock DB, and a valid patch reaches it through
//      exactly the insert/update/delete shape each caller needs.
//   3. Structural guards: PLACE_PROFILE_PATCH_KEYS / PLACE_PATCH_KEYS never
//      collide, and `name` / `google_place_id` are refused the way repo
//      law requires (place_profiles.name generated column, google_place_id
//      immutable spine).

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  PLACE_PROFILE_PATCH_KEYS,
  type PlaceProfilePatch,
  PLACE_PATCH_KEYS,
  type PlacePatch,
  validatePlaceProfilePatch,
  validateProfilePatch,
  validatePlacePatch,
  writePlace,
} from "./place-doc.ts";

// ── structural guards ───────────────────────────────────────────────────────

Deno.test("PLACE_PROFILE_PATCH_KEYS and PLACE_PATCH_KEYS never collide", () => {
  const places = new Set(PLACE_PROFILE_PATCH_KEYS as readonly string[]);
  const overlap = (PLACE_PATCH_KEYS as readonly string[]).filter((k) => places.has(k));
  assertEquals(overlap, [], "a key claimed by both tables would be ambiguous for validateProfilePatch");
});

Deno.test("validatePlaceProfilePatch: rejects `name` — it is a GENERATED column, never a patch key", () => {
  const res = validatePlaceProfilePatch({ name: "Café Central" });
  assert(!res.ok);
  assertEquals(res.error, "unknown place field: name");
});

Deno.test("validateProfilePatch: rejects `name` too", () => {
  const res = validateProfilePatch({ name: "Café Central" });
  assert(!res.ok);
  assertEquals(res.error, "unknown profile field: name");
});

// The four acceptance intent bits were legalized 2026-08-29 (Pato gate: the
// Partner tab toggles are their writer, the Promotion score their reader).
// They stay PLACES-ONLY: the profiles_update trigger predates the columns
// and would silently drop them, so the profiles door refuses loudly.
Deno.test("validatePlaceProfilePatch: accepts the four acceptance intent bits as booleans", () => {
  const res = validatePlaceProfilePatch({
    mesita_pay_enabled: true,
    credits_enabled: false,
    pickup_orders_enabled: true,
    delivery_orders_enabled: false,
  });
  assert(res.ok);
});

Deno.test("validatePlaceProfilePatch: rejects a non-boolean intent bit", () => {
  const res = validatePlaceProfilePatch({ mesita_pay_enabled: "yes" });
  assert(!res.ok);
  assertEquals(res.error, "mesita_pay_enabled must be a boolean");
});

Deno.test("validateProfilePatch: refuses intent bits — place_profiles-only keys", () => {
  const pay = validateProfilePatch({ mesita_pay_enabled: true });
  assert(!pay.ok);
  assertEquals(
    pay.error,
    'mesita_pay_enabled writes through table "place_profiles" only — ' +
      "the profiles trigger would silently drop it",
  );
  const pickup = validateProfilePatch({ pickup_orders_enabled: true });
  assert(!pickup.ok);
});

// #1395 added these two to PLACE_PROFILE_PATCH_KEYS without a checkPlaceProfileField branch
// — the door rejected every patch carrying them ("unknown place field"),
// which would have aborted the contents publish and the create door-write
// after the 2026-08-29 redeploy sweep. This pins the repair.
Deno.test("validatePlaceProfilePatch: accepts orders_enabled / reservations_enabled (the #1395 regression)", () => {
  const res = validatePlaceProfilePatch({ orders_enabled: true, reservations_enabled: false });
  assert(res.ok);
  const bad = validatePlaceProfilePatch({ orders_enabled: 1 });
  assert(!bad.ok);
  assertEquals(bad.error, "orders_enabled must be a boolean");
});

// ── validatePlaceProfilePatch: accept ──────────────────────────────────────────────

Deno.test("validatePlaceProfilePatch: accepts a narrow enrichment-schedule patch", () => {
  const res = validatePlaceProfilePatch({
    enrich_every_days: 30,
    enrich_mode: "full",
    enrich_next_at: "2026-09-22T00:00:00Z",
  });
  assert(res.ok);
});

Deno.test("validatePlaceProfilePatch: accepts null enrich_every_days (schedule cleared)", () => {
  assert(validatePlaceProfilePatch({ enrich_every_days: null }).ok);
});

Deno.test("validatePlaceProfilePatch: accepts business_state + business_state_at together", () => {
  const res = validatePlaceProfilePatch({
    business_state: "CLOSED_TEMPORARILY",
    business_state_at: "2026-08-23T00:00:00Z",
  });
  assert(res.ok);
});

Deno.test("validatePlaceProfilePatch: accepts business_state = null (Google was silent)", () => {
  assert(validatePlaceProfilePatch({ business_state: null }).ok);
});

Deno.test("validatePlaceProfilePatch: accepts star ratings at the boundaries (0 and 5) and null", () => {
  assert(validatePlaceProfilePatch({ mesita_stars_overall: 0 }).ok);
  assert(validatePlaceProfilePatch({ mesita_stars_overall: 5 }).ok);
  assert(validatePlaceProfilePatch({ google_stars_overall: null }).ok);
});

Deno.test("validatePlaceProfilePatch: accepts non-negative counts", () => {
  const res = validatePlaceProfilePatch({
    google_review_count: 0,
    instagram_followers_count: 12_500,
    facebook_followers: null,
  });
  assert(res.ok);
});

Deno.test("validatePlaceProfilePatch: accepts price_level 1..4", () => {
  assert(validatePlaceProfilePatch({ price_level: 1 }).ok);
  assert(validatePlaceProfilePatch({ price_level: 4 }).ok);
  assert(validatePlaceProfilePatch({ price_level: null }).ok);
});

Deno.test("validatePlaceProfilePatch: accepts every serving channel or null", () => {
  assert(validatePlaceProfilePatch({ reservation_channel: "phone", reservation_target: "+525512345678" }).ok);
  assert(validatePlaceProfilePatch({ reservation_channel: "whatsapp" }).ok);
  assert(validatePlaceProfilePatch({ reservation_channel: "instagram" }).ok);
  assert(validatePlaceProfilePatch({ reservation_channel: "web" }).ok);
  assert(validatePlaceProfilePatch({ reservation_channel: "none" }).ok);
  assert(validatePlaceProfilePatch({ order_channel: null, order_target: null }).ok);
  assert(validatePlaceProfilePatch({ order_channel: "web", order_target: "https://example.com" }).ok);
});

Deno.test("validatePlaceProfilePatch: accepts string-array fields", () => {
  const res = validatePlaceProfilePatch({
    photos: ["https://cdn.example.com/a.jpg"],
    tags: ["brunch", "rooftop"],
  });
  assert(res.ok);
});

Deno.test("validatePlaceProfilePatch: family_keys is nullable until enrichment", () => {
  assert(validatePlaceProfilePatch({ family_keys: null }).ok);
  assert(validatePlaceProfilePatch({ family_keys: ["restaurants", "cafes_bakeries"] }).ok);
  assert(!validatePlaceProfilePatch({ family_keys: "restaurants" }).ok);
});

Deno.test("validatePlaceProfilePatch: accepts jsonb fields as object, array, or null", () => {
  assert(validatePlaceProfilePatch({ hours: { mon: [{ open: "09:00", close: "18:00" }] } }).ok);
  assert(
    validatePlaceProfilePatch({
      google_reviews: [{ author: "Ana", rating: 5, quote: "great", date: "2026-01-01" }],
    }).ok,
  );
  assert(validatePlaceProfilePatch({ products: null }).ok);
});

// MESITA-1247 reconciliation: details/google_reviews/popular_times are no
// longer opaque jsonb here — place-jsonb-schemas.ts (PR #1163) is folded
// into this door so EVERY caller of writePlace gets the same content
// validation the enrich-synthesis-profile.ts/enrich-google-basics.ts call
// sites already had inline, not just those two.
Deno.test("validatePlaceProfilePatch: details/google_reviews/popular_times accept null (clearing the column)", () => {
  assert(validatePlaceProfilePatch({ details: null }).ok);
  assert(validatePlaceProfilePatch({ google_reviews: null }).ok);
  assert(validatePlaceProfilePatch({ popular_times: null }).ok);
});

Deno.test("validatePlaceProfilePatch: details/google_reviews/popular_times accept a real partial shape", () => {
  assert(validatePlaceProfilePatch({ details: { dress_code: "casual" } }).ok);
  assert(validatePlaceProfilePatch({ popular_times: [{ day: "Mon", range: "12-3pm" }] }).ok);
});

Deno.test("validatePlaceProfilePatch: rejects a hallucinated key or wrong-typed field inside the jsonb blobs", () => {
  const badDetails = validatePlaceProfilePatch({ details: { dress_code: "casual", vibe: "cozy" } });
  assert(!badDetails.ok);
  const badReview = validatePlaceProfilePatch({ google_reviews: [{ text: "great" }] });
  assert(!badReview.ok, "a review missing author/rating/quote/date must be rejected, not passed through opaque");
  const badPopular = validatePlaceProfilePatch({ popular_times: [{ day: "Mon" }] });
  assert(!badPopular.ok, "a popular_times entry missing range must be rejected");
});

// MESITA-1249: place_profiles.enrichment (the materialized progress meter) — NOT
// nullable, unlike details/google_reviews/popular_times above, since the
// column carries a NOT NULL default. Full accept/reject coverage lives in
// schema-catalog.test.ts next to EnrichmentMapSchema itself; these two just
// prove the door actually wires that schema in for the "enrichment" key.
Deno.test("validatePlaceProfilePatch: accepts a real place_profiles.enrichment patch", () => {
  const res = validatePlaceProfilePatch({
    enrichment: {
      functions: { pulse: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" } },
      highWater: 1,
      blockedAt: { key: "details", index: 2, state: "missing" },
    },
  });
  assert(res.ok);
});

Deno.test("validatePlaceProfilePatch: rejects place_profiles.enrichment = null (the column is NOT NULL, unlike the other jsonb fields)", () => {
  assert(!validatePlaceProfilePatch({ enrichment: null }).ok);
});

Deno.test("validatePlaceProfilePatch: rejects an enrichment patch smuggling the deliberately-not-folded schedule keys", () => {
  const res = validatePlaceProfilePatch({
    enrichment: { functions: {}, highWater: 0, blockedAt: null, everyDays: 30 },
  });
  assert(!res.ok);
});

Deno.test("validatePlaceProfilePatch: accepts a mesita_name override alone (google_name untouched)", () => {
  assert(validatePlaceProfilePatch({ mesita_name: "El Nuevo Nombre" }).ok);
});

Deno.test("validatePlaceProfilePatch: accepts mesita_name and google_name together when one is non-empty", () => {
  assert(validatePlaceProfilePatch({ mesita_name: null, google_name: "Google's Label" }).ok);
  assert(validatePlaceProfilePatch({ mesita_name: "Override", google_name: "" }).ok);
});

// ── validatePlaceProfilePatch: reject ──────────────────────────────────────────────

Deno.test("validatePlaceProfilePatch: rejects a non-object input", () => {
  assert(!validatePlaceProfilePatch(null).ok);
  assert(!validatePlaceProfilePatch("nope").ok);
  assert(!validatePlaceProfilePatch([1, 2, 3]).ok);
});

Deno.test("validatePlaceProfilePatch: rejects an unknown field (closed key set)", () => {
  const res = validatePlaceProfilePatch({ is_admin: true });
  assert(!res.ok);
  assertEquals(res.error, "unknown place field: is_admin");
});

Deno.test("validatePlaceProfilePatch: rejects enrich_every_days outside 1..365", () => {
  assert(!validatePlaceProfilePatch({ enrich_every_days: 0 }).ok);
  assert(!validatePlaceProfilePatch({ enrich_every_days: 366 }).ok);
});

Deno.test("validatePlaceProfilePatch: rejects an enrich_mode outside the closed set, and null", () => {
  assert(!validatePlaceProfilePatch({ enrich_mode: "partial" }).ok);
  assert(!validatePlaceProfilePatch({ enrich_mode: null }).ok);
});

Deno.test("validatePlaceProfilePatch: rejects a business_state outside the closed set", () => {
  assert(!validatePlaceProfilePatch({ business_state: "TEMPORARILY_CLOSED" }).ok);
});

Deno.test("validatePlaceProfilePatch: rejects a star rating outside 0..5", () => {
  assert(!validatePlaceProfilePatch({ mesita_stars_food: -0.1 }).ok);
  assert(!validatePlaceProfilePatch({ facebook_rating: 5.1 }).ok);
});

Deno.test("validatePlaceProfilePatch: rejects a negative count", () => {
  assert(!validatePlaceProfilePatch({ google_review_count: -1 }).ok);
});

Deno.test("validatePlaceProfilePatch: rejects price_level outside 1..4", () => {
  assert(!validatePlaceProfilePatch({ price_level: 0 }).ok);
  assert(!validatePlaceProfilePatch({ price_level: 5 }).ok);
});

Deno.test("validatePlaceProfilePatch: rejects an unknown routing channel", () => {
  const res = validatePlaceProfilePatch({ reservation_channel: "email" });
  assert(!res.ok);
});

Deno.test("validatePlaceProfilePatch: rejects a string where an array is required", () => {
  assert(!validatePlaceProfilePatch({ tags: "brunch" }).ok);
  assert(!validatePlaceProfilePatch({ photos: null }).ok, "photos is NOT NULL — no null patch value");
});

Deno.test("validatePlaceProfilePatch: rejects a scalar where jsonb is required", () => {
  assert(!validatePlaceProfilePatch({ hours: "always open" }).ok);
});

Deno.test("validatePlaceProfilePatch: rejects mesita_name and google_name both empty in the same patch (place_profiles_name_source_present)", () => {
  const res = validatePlaceProfilePatch({ mesita_name: null, google_name: "" });
  assert(!res.ok);
  assertEquals(
    res.error,
    "mesita_name and google_name cannot both be empty in the same patch " +
      "(place_profiles_name_source_present — place_profiles.name would have nothing to generate from)",
  );
});

Deno.test("validatePlaceProfilePatch: rejects google_place_id of the wrong type", () => {
  assert(!validatePlaceProfilePatch({ google_place_id: 12345 }).ok);
});

// ── validatePlacePatch: accept ────────────────────────────────────────────

Deno.test("validatePlacePatch: accepts a state transition within the closed enum", () => {
  assert(validatePlacePatch({ state: "active" }).ok);
  assert(validatePlacePatch({ state: "pending_verification" }).ok);
});

Deno.test("validatePlacePatch: accepts plan + listing_type + rate fields", () => {
  const res = validatePlacePatch({
    plan: "pro",
    listing_type: "partner",
    welcome_free_rate: 20,
    free_rate: null,
  });
  assert(res.ok);
});

Deno.test("validatePlacePatch: accepts monthly_promo_cap in the legal set, and null", () => {
  assert(validatePlacePatch({ monthly_promo_cap: 500 }).ok);
  assert(validatePlacePatch({ monthly_promo_cap: null }).ok);
});

Deno.test("validatePlacePatch: accepts strike_count at the boundaries", () => {
  assert(validatePlacePatch({ strike_count: 0 }).ok);
  assert(validatePlacePatch({ strike_count: 3 }).ok);
});

Deno.test("validatePlacePatch: accepts a well-formed check_pin, and null", () => {
  assert(validatePlacePatch({ check_pin: "123456" }).ok);
  assert(validatePlacePatch({ check_pin: null }).ok);
});

Deno.test("validatePlacePatch: accepts well-formed CFDI fields", () => {
  const res = validatePlacePatch({
    cfdi_rfc: "ABC123456XY9",
    cfdi_cp: "64000",
    cfdi_razon_social: "Restaurante Ejemplo SA de CV",
  });
  assert(res.ok);
});

Deno.test("validatePlacePatch: accepts the content_state ladder", () => {
  for (const s of ["queued", "generating", "ready", "failed"]) {
    assert(validatePlacePatch({ content_state: s }).ok, s);
  }
});

// ── validatePlacePatch: reject ────────────────────────────────────────────

Deno.test("validatePlacePatch: rejects an unknown field (closed key set)", () => {
  const res = validatePlacePatch({ owner_id: "some-uuid" });
  assert(!res.ok);
  assertEquals(res.error, "unknown place-row field: owner_id");
});

Deno.test("validatePlacePatch: rejects a state outside the closed enum", () => {
  assert(!validatePlacePatch({ state: "deleted" }).ok);
});

Deno.test("validatePlacePatch: rejects a rate outside the legal tens grid", () => {
  assert(!validatePlacePatch({ free_rate: 25 }).ok, "not in {10,20,30,40,50}");
  assert(!validatePlacePatch({ premium_rate: 70 }).ok, "70 was retired, MESITA-543");
});

Deno.test("validatePlacePatch: rejects a monthly_promo_cap outside the legal set", () => {
  assert(!validatePlacePatch({ monthly_promo_cap: 750 }).ok);
});

Deno.test("validatePlacePatch: rejects strike_count outside 0..3", () => {
  assert(!validatePlacePatch({ strike_count: 4 }).ok);
  assert(!validatePlacePatch({ strike_count: -1 }).ok);
});

Deno.test("validatePlacePatch: rejects a malformed check_pin", () => {
  assert(!validatePlacePatch({ check_pin: "12345" }).ok, "5 digits");
  assert(!validatePlacePatch({ check_pin: "abcdef" }).ok, "non-digits");
});

Deno.test("validatePlacePatch: rejects a malformed CFDI RFC / CP", () => {
  assert(!validatePlacePatch({ cfdi_rfc: "TOO-SHORT" }).ok);
  assert(!validatePlacePatch({ cfdi_cp: "640" }).ok);
});

Deno.test("validatePlacePatch: rejects a discount_cap_cents that is negative", () => {
  assert(!validatePlacePatch({ discount_cap_cents: -100 }).ok);
});

Deno.test("validatePlacePatch: rejects null on a NOT NULL boolean/enum", () => {
  assert(!validatePlacePatch({ segmentation_basic_enabled: null }).ok);
  assert(!validatePlacePatch({ plan: null }).ok);
});

// ── validateProfilePatch ────────────────────────────────────────────────────

Deno.test("validateProfilePatch: accepts a patch mixing place_profiles and places fields, like the view's real callers send", () => {
  const res = validateProfilePatch({
    mesita_name: "El Nuevo Nombre",
    category: "cafe",
    state: "active",
    welcome_free_rate: 20,
  });
  assert(res.ok);
});

Deno.test("validateProfilePatch: still enforces each field's own rule regardless of which table it belongs to", () => {
  assert(!validateProfilePatch({ state: "deleted" }).ok, "bad places field");
  assert(!validateProfilePatch({ price_level: 9 }).ok, "bad place_profiles field");
});

// ── writePlace: the write door itself ───────────────────────────────────────

/** Throws if the mock's .from() is ever called — proves validation gates
 * before any DB call happens. */
function unreachableAdmin(): SupabaseClient {
  return {
    from() {
      throw new Error("writePlace must not reach the DB on an invalid patch");
    },
  } as unknown as SupabaseClient;
}

Deno.test("writePlace: an invalid place_profiles patch never reaches the DB", async () => {
  const admin = unreachableAdmin();
  // Simulates the same Belt 1 bypass consumer-doc.test.ts documents: a real
  // caller decodes HTTP JSON as `unknown` and casts before calling the door.
  const invalidPatch = { price_level: 9 } as unknown as PlaceProfilePatch;
  const res = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: "11111111-1111-1111-1111-111111111111",
    patch: invalidPatch,
  });
  assert(!res.ok);
  assertEquals(res.error, "price_level must be between 1 and 4, or null");
});

Deno.test("writePlace: an invalid places patch never reaches the DB", async () => {
  const admin = unreachableAdmin();
  const invalidPatch = { strike_count: 9 } as unknown as PlacePatch;
  const res = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: "place-1",
    patch: invalidPatch,
  });
  assert(!res.ok);
  assertEquals(res.error, "strike_count must be an integer between 0 and 3");
});

Deno.test("writePlace: refuses to update google_place_id, before validation even runs", async () => {
  const admin = unreachableAdmin();
  const res = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: "place-1",
    patch: { google_place_id: "ChIJ-new-value" },
  });
  assert(!res.ok);
  assertEquals(res.error, "google_place_id is immutable once set — only the create path may write it");
});

// Minimal Supabase mock recording the last insert/update/delete call,
// matching the fakeConsumerAdmin() shape consumer-doc.test.ts already uses.
function fakePlaceAdmin(opts: { row?: Record<string, unknown>; errorCode?: string } = {}): {
  admin: SupabaseClient;
  calls: { table: string; op: "insert" | "update" | "delete"; value?: Record<string, unknown> }[];
} {
  const calls: { table: string; op: "insert" | "update" | "delete"; value?: Record<string, unknown> }[] = [];
  const error = opts.errorCode ? { message: "conflict", code: opts.errorCode } : null;
  const terminal = () => Promise.resolve({ data: null, error });
  const selectable = () => ({
    select: () => ({
      single: () => Promise.resolve({ data: opts.row ?? null, error }),
      maybeSingle: () => Promise.resolve({ data: opts.row ?? null, error }),
    }),
    then: (resolve: (v: unknown) => void) => resolve({ data: null, error }),
  });
  const admin = {
    from: (table: string) => ({
      insert: (value: Record<string, unknown>) => {
        calls.push({ table, op: "insert", value });
        return selectable();
      },
      update: (value: Record<string, unknown>) => {
        calls.push({ table, op: "update", value });
        const eqChain: { eq: (col: string, v: unknown) => unknown; select: () => unknown } = {
          eq: () => eqChain,
          select: () => ({
            single: () => Promise.resolve({ data: opts.row ?? null, error }),
            maybeSingle: () => Promise.resolve({ data: opts.row ?? null, error }),
          }),
        };
        return eqChain;
      },
      delete: () => ({
        eq: () => {
          calls.push({ table, op: "delete" });
          return terminal();
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { admin, calls };
}

Deno.test("writePlace: place_profiles update writes exactly the validated patch, no select", async () => {
  const { admin, calls } = fakePlaceAdmin();
  const res = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: "place-1",
    patch: { instagram_followers_count: 3000 },
  });
  assert(res.ok);
  assertEquals(res.row, null);
  assertEquals(calls, [{ table: "place_profiles", op: "update", value: { instagram_followers_count: 3000 } }]);
});

Deno.test("writePlace: place_profiles insert with select returns the re-read row", async () => {
  const { admin } = fakePlaceAdmin({ row: { id: "place-1" } });
  const res = await writePlace(admin, {
    table: "place_profiles",
    mode: "insert",
    patch: { google_place_id: "ChIJ123", category: "cafe" },
    select: "id",
  });
  assert(res.ok);
  assertEquals(res.row, { id: "place-1" });
});

Deno.test("writePlace: places insert carries the shared id alongside the patch", async () => {
  const { admin, calls } = fakePlaceAdmin({ row: { id: "place-1", slug: "cafe-central", state: "active" } });
  const res = await writePlace(admin, {
    table: "places",
    mode: "insert",
    id: "place-1",
    patch: { slug: "cafe-central", state: "active", content_state: "ready" },
    select: "id, slug, state",
  });
  assert(res.ok);
  assertEquals(calls[0].value, {
    id: "place-1",
    slug: "cafe-central",
    state: "active",
    content_state: "ready",
  });
});

Deno.test("writePlace: place_profiles delete goes through .eq(id), not a bare table scan", async () => {
  const { admin, calls } = fakePlaceAdmin();
  const res = await writePlace(admin, { table: "place_profiles", mode: "delete", id: "place-1" });
  assert(res.ok);
  assertEquals(calls, [{ table: "place_profiles", op: "delete" }]);
});

Deno.test("writePlace: profiles update accepts a patch mixing both tables' fields", async () => {
  const { admin, calls } = fakePlaceAdmin();
  const res = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: "place-1",
    patch: { mesita_name: "Nuevo Nombre", state: "active" },
  });
  assert(res.ok);
  assertEquals(calls, [{
    table: "profiles",
    op: "update",
    value: { mesita_name: "Nuevo Nombre", state: "active" },
  }]);
});

Deno.test("writePlace: surfaces the Postgres error code for a unique-violation retry", async () => {
  const { admin } = fakePlaceAdmin({ errorCode: "23505" });
  const res = await writePlace(admin, {
    table: "place_profiles",
    mode: "insert",
    patch: { google_place_id: "ChIJ123" },
    select: "id",
  });
  assert(!res.ok);
  assertEquals(res.code, "23505");
});

Deno.test("writePlace: maybeSingle select mode reaches the DB the same as single", async () => {
  const { admin } = fakePlaceAdmin();
  const res = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: "missing-place",
    patch: { state: "active" },
    select: "id",
    selectMode: "maybeSingle",
  });
  assert(res.ok);
  assertEquals(res.row, null);
});
