// Guard tests for the place aggregate validator + write door (MESITA-1279).
//
// Run: deno test supabase/functions/_shared/place-doc.test.ts
//
// Three groups:
//   1. validatePlacePatch / validateProjectPatch / validateProfilePatch
//      accept/reject — belt 2, exercised against the invariants documented
//      in place-doc.ts (each traced to a live CHECK constraint or enum).
//   2. writePlace — proves the write door actually GATES: an invalid patch
//      never reaches the mock DB, and a valid patch reaches it through
//      exactly the insert/update/delete shape each caller needs.
//   3. Structural guards: PLACE_PATCH_KEYS / PROJECT_PATCH_KEYS never
//      collide, and `name` / `google_place_id` are refused the way repo
//      law requires (places.name generated column, google_place_id
//      immutable spine).

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  PLACE_PATCH_KEYS,
  type PlacePatch,
  PROJECT_PATCH_KEYS,
  type ProjectPatch,
  validatePlacePatch,
  validateProfilePatch,
  validateProjectPatch,
  writePlace,
} from "./place-doc.ts";

// ── structural guards ───────────────────────────────────────────────────────

Deno.test("PLACE_PATCH_KEYS and PROJECT_PATCH_KEYS never collide", () => {
  const places = new Set(PLACE_PATCH_KEYS as readonly string[]);
  const overlap = (PROJECT_PATCH_KEYS as readonly string[]).filter((k) => places.has(k));
  assertEquals(overlap, [], "a key claimed by both tables would be ambiguous for validateProfilePatch");
});

Deno.test("validatePlacePatch: rejects `name` — it is a GENERATED column, never a patch key", () => {
  const res = validatePlacePatch({ name: "Café Central" });
  assert(!res.ok);
  assertEquals(res.error, "unknown place field: name");
});

Deno.test("validateProfilePatch: rejects `name` too", () => {
  const res = validateProfilePatch({ name: "Café Central" });
  assert(!res.ok);
  assertEquals(res.error, "unknown profile field: name");
});

// The settlement acceptance intent bits are real columns but DELIBERATELY not
// patch keys: no engine exists, so a writable flag would be unenforced config
// (Pato gate 2026-08-29). The gateway / Credits PRs legalize each key for
// their own writer — which must target `places`, never `profiles` (the
// profiles_update trigger silently drops unknown columns).
Deno.test("validatePlacePatch: rejects the acceptance intent bits until their engines exist", () => {
  const pay = validatePlacePatch({ mesita_pay_enabled: true });
  assert(!pay.ok);
  assertEquals(pay.error, "unknown place field: mesita_pay_enabled");
  const yums = validatePlacePatch({ yums_enabled: true });
  assert(!yums.ok);
  assertEquals(yums.error, "unknown place field: yums_enabled");
});

Deno.test("validateProfilePatch: rejects the acceptance intent bits too", () => {
  const pay = validateProfilePatch({ mesita_pay_enabled: true });
  assert(!pay.ok);
  assertEquals(pay.error, "unknown profile field: mesita_pay_enabled");
  const yums = validateProfilePatch({ yums_enabled: false });
  assert(!yums.ok);
  assertEquals(yums.error, "unknown profile field: yums_enabled");
});

// ── validatePlacePatch: accept ──────────────────────────────────────────────

Deno.test("validatePlacePatch: accepts a narrow enrichment-schedule patch", () => {
  const res = validatePlacePatch({
    enrich_every_days: 30,
    enrich_mode: "full",
    enrich_next_at: "2026-09-22T00:00:00Z",
  });
  assert(res.ok);
});

Deno.test("validatePlacePatch: accepts null enrich_every_days (schedule cleared)", () => {
  assert(validatePlacePatch({ enrich_every_days: null }).ok);
});

Deno.test("validatePlacePatch: accepts business_status + business_status_at together", () => {
  const res = validatePlacePatch({
    business_status: "CLOSED_TEMPORARILY",
    business_status_at: "2026-08-23T00:00:00Z",
  });
  assert(res.ok);
});

Deno.test("validatePlacePatch: accepts business_status = null (Google was silent)", () => {
  assert(validatePlacePatch({ business_status: null }).ok);
});

Deno.test("validatePlacePatch: accepts star ratings at the boundaries (0 and 5) and null", () => {
  assert(validatePlacePatch({ mesita_stars_overall: 0 }).ok);
  assert(validatePlacePatch({ mesita_stars_overall: 5 }).ok);
  assert(validatePlacePatch({ google_stars_overall: null }).ok);
});

Deno.test("validatePlacePatch: accepts non-negative counts", () => {
  const res = validatePlacePatch({
    google_review_count: 0,
    instagram_followers_count: 12_500,
    facebook_followers: null,
  });
  assert(res.ok);
});

Deno.test("validatePlacePatch: accepts price_level 1..4", () => {
  assert(validatePlacePatch({ price_level: 1 }).ok);
  assert(validatePlacePatch({ price_level: 4 }).ok);
  assert(validatePlacePatch({ price_level: null }).ok);
});

Deno.test("validatePlacePatch: accepts every serving channel or null", () => {
  assert(validatePlacePatch({ reservation_channel: "phone", reservation_target: "+525512345678" }).ok);
  assert(validatePlacePatch({ reservation_channel: "whatsapp" }).ok);
  assert(validatePlacePatch({ reservation_channel: "instagram" }).ok);
  assert(validatePlacePatch({ reservation_channel: "web" }).ok);
  assert(validatePlacePatch({ reservation_channel: "none" }).ok);
  assert(validatePlacePatch({ order_channel: null, order_target: null }).ok);
  assert(validatePlacePatch({ order_channel: "web", order_target: "https://example.com" }).ok);
});

Deno.test("validatePlacePatch: accepts string-array fields", () => {
  const res = validatePlacePatch({
    photos: ["https://cdn.example.com/a.jpg"],
    tags: ["brunch", "rooftop"],
  });
  assert(res.ok);
});

Deno.test("validatePlacePatch: family_keys is nullable until enrichment", () => {
  assert(validatePlacePatch({ family_keys: null }).ok);
  assert(validatePlacePatch({ family_keys: ["restaurants", "cafes_bakeries"] }).ok);
  assert(!validatePlacePatch({ family_keys: "restaurants" }).ok);
});

Deno.test("validatePlacePatch: accepts jsonb fields as object, array, or null", () => {
  assert(validatePlacePatch({ hours: { mon: [{ open: "09:00", close: "18:00" }] } }).ok);
  assert(
    validatePlacePatch({
      google_reviews: [{ author: "Ana", rating: 5, quote: "great", date: "2026-01-01" }],
    }).ok,
  );
  assert(validatePlacePatch({ products: null }).ok);
});

// MESITA-1247 reconciliation: details/google_reviews/popular_times are no
// longer opaque jsonb here — place-jsonb-schemas.ts (PR #1163) is folded
// into this door so EVERY caller of writePlace gets the same content
// validation the enrich-synthesis-profile.ts/enrich-google-basics.ts call
// sites already had inline, not just those two.
Deno.test("validatePlacePatch: details/google_reviews/popular_times accept null (clearing the column)", () => {
  assert(validatePlacePatch({ details: null }).ok);
  assert(validatePlacePatch({ google_reviews: null }).ok);
  assert(validatePlacePatch({ popular_times: null }).ok);
});

Deno.test("validatePlacePatch: details/google_reviews/popular_times accept a real partial shape", () => {
  assert(validatePlacePatch({ details: { dress_code: "casual" } }).ok);
  assert(validatePlacePatch({ popular_times: [{ day: "Mon", range: "12-3pm" }] }).ok);
});

Deno.test("validatePlacePatch: rejects a hallucinated key or wrong-typed field inside the jsonb blobs", () => {
  const badDetails = validatePlacePatch({ details: { dress_code: "casual", vibe: "cozy" } });
  assert(!badDetails.ok);
  const badReview = validatePlacePatch({ google_reviews: [{ text: "great" }] });
  assert(!badReview.ok, "a review missing author/rating/quote/date must be rejected, not passed through opaque");
  const badPopular = validatePlacePatch({ popular_times: [{ day: "Mon" }] });
  assert(!badPopular.ok, "a popular_times entry missing range must be rejected");
});

// MESITA-1249: places.enrichment (the materialized progress meter) — NOT
// nullable, unlike details/google_reviews/popular_times above, since the
// column carries a NOT NULL default. Full accept/reject coverage lives in
// schema-catalog.test.ts next to EnrichmentMapSchema itself; these two just
// prove the door actually wires that schema in for the "enrichment" key.
Deno.test("validatePlacePatch: accepts a real places.enrichment patch", () => {
  const res = validatePlacePatch({
    enrichment: {
      functions: { pulse: { status: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" } },
      highWater: 1,
      blockedAt: { key: "details", index: 2, status: "missing" },
    },
  });
  assert(res.ok);
});

Deno.test("validatePlacePatch: rejects places.enrichment = null (the column is NOT NULL, unlike the other jsonb fields)", () => {
  assert(!validatePlacePatch({ enrichment: null }).ok);
});

Deno.test("validatePlacePatch: rejects an enrichment patch smuggling the deliberately-not-folded schedule keys", () => {
  const res = validatePlacePatch({
    enrichment: { functions: {}, highWater: 0, blockedAt: null, everyDays: 30 },
  });
  assert(!res.ok);
});

Deno.test("validatePlacePatch: accepts a mesita_name override alone (google_name untouched)", () => {
  assert(validatePlacePatch({ mesita_name: "El Nuevo Nombre" }).ok);
});

Deno.test("validatePlacePatch: accepts mesita_name and google_name together when one is non-empty", () => {
  assert(validatePlacePatch({ mesita_name: null, google_name: "Google's Label" }).ok);
  assert(validatePlacePatch({ mesita_name: "Override", google_name: "" }).ok);
});

// ── validatePlacePatch: reject ──────────────────────────────────────────────

Deno.test("validatePlacePatch: rejects a non-object input", () => {
  assert(!validatePlacePatch(null).ok);
  assert(!validatePlacePatch("nope").ok);
  assert(!validatePlacePatch([1, 2, 3]).ok);
});

Deno.test("validatePlacePatch: rejects an unknown field (closed key set)", () => {
  const res = validatePlacePatch({ is_admin: true });
  assert(!res.ok);
  assertEquals(res.error, "unknown place field: is_admin");
});

Deno.test("validatePlacePatch: rejects enrich_every_days outside 1..365", () => {
  assert(!validatePlacePatch({ enrich_every_days: 0 }).ok);
  assert(!validatePlacePatch({ enrich_every_days: 366 }).ok);
});

Deno.test("validatePlacePatch: rejects an enrich_mode outside the closed set, and null", () => {
  assert(!validatePlacePatch({ enrich_mode: "partial" }).ok);
  assert(!validatePlacePatch({ enrich_mode: null }).ok);
});

Deno.test("validatePlacePatch: rejects a business_status outside the closed set", () => {
  assert(!validatePlacePatch({ business_status: "TEMPORARILY_CLOSED" }).ok);
});

Deno.test("validatePlacePatch: rejects a star rating outside 0..5", () => {
  assert(!validatePlacePatch({ mesita_stars_food: -0.1 }).ok);
  assert(!validatePlacePatch({ facebook_rating: 5.1 }).ok);
});

Deno.test("validatePlacePatch: rejects a negative count", () => {
  assert(!validatePlacePatch({ google_review_count: -1 }).ok);
});

Deno.test("validatePlacePatch: rejects price_level outside 1..4", () => {
  assert(!validatePlacePatch({ price_level: 0 }).ok);
  assert(!validatePlacePatch({ price_level: 5 }).ok);
});

Deno.test("validatePlacePatch: rejects an unknown routing channel", () => {
  const res = validatePlacePatch({ reservation_channel: "email" });
  assert(!res.ok);
});

Deno.test("validatePlacePatch: rejects a string where an array is required", () => {
  assert(!validatePlacePatch({ tags: "brunch" }).ok);
  assert(!validatePlacePatch({ photos: null }).ok, "photos is NOT NULL — no null patch value");
});

Deno.test("validatePlacePatch: rejects a scalar where jsonb is required", () => {
  assert(!validatePlacePatch({ hours: "always open" }).ok);
});

Deno.test("validatePlacePatch: rejects mesita_name and google_name both empty in the same patch (places_name_source_present)", () => {
  const res = validatePlacePatch({ mesita_name: null, google_name: "" });
  assert(!res.ok);
  assertEquals(
    res.error,
    "mesita_name and google_name cannot both be empty in the same patch " +
      "(places_name_source_present — places.name would have nothing to generate from)",
  );
});

Deno.test("validatePlacePatch: rejects google_place_id of the wrong type", () => {
  assert(!validatePlacePatch({ google_place_id: 12345 }).ok);
});

// ── validateProjectPatch: accept ────────────────────────────────────────────

Deno.test("validateProjectPatch: accepts a status transition within the closed enum", () => {
  assert(validateProjectPatch({ status: "active" }).ok);
  assert(validateProjectPatch({ status: "pending_verification" }).ok);
});

Deno.test("validateProjectPatch: accepts plan + listing_type + rate fields", () => {
  const res = validateProjectPatch({
    plan: "pro",
    listing_type: "partner",
    welcome_free_rate: 20,
    free_rate: null,
  });
  assert(res.ok);
});

Deno.test("validateProjectPatch: accepts monthly_promo_cap in the legal set, and null", () => {
  assert(validateProjectPatch({ monthly_promo_cap: 500 }).ok);
  assert(validateProjectPatch({ monthly_promo_cap: null }).ok);
});

Deno.test("validateProjectPatch: accepts strike_count at the boundaries", () => {
  assert(validateProjectPatch({ strike_count: 0 }).ok);
  assert(validateProjectPatch({ strike_count: 3 }).ok);
});

Deno.test("validateProjectPatch: accepts a well-formed check_pin, and null", () => {
  assert(validateProjectPatch({ check_pin: "123456" }).ok);
  assert(validateProjectPatch({ check_pin: null }).ok);
});

Deno.test("validateProjectPatch: accepts well-formed CFDI fields", () => {
  const res = validateProjectPatch({
    cfdi_rfc: "ABC123456XY9",
    cfdi_cp: "64000",
    cfdi_razon_social: "Restaurante Ejemplo SA de CV",
  });
  assert(res.ok);
});

Deno.test("validateProjectPatch: accepts the content_status ladder", () => {
  for (const s of ["queued", "generating", "ready", "failed"]) {
    assert(validateProjectPatch({ content_status: s }).ok, s);
  }
});

// ── validateProjectPatch: reject ────────────────────────────────────────────

Deno.test("validateProjectPatch: rejects an unknown field (closed key set)", () => {
  const res = validateProjectPatch({ owner_id: "some-uuid" });
  assert(!res.ok);
  assertEquals(res.error, "unknown project field: owner_id");
});

Deno.test("validateProjectPatch: rejects a status outside the closed enum", () => {
  assert(!validateProjectPatch({ status: "deleted" }).ok);
});

Deno.test("validateProjectPatch: rejects a rate outside the legal tens grid", () => {
  assert(!validateProjectPatch({ free_rate: 25 }).ok, "not in {10,20,30,40,50}");
  assert(!validateProjectPatch({ premium_rate: 70 }).ok, "70 was retired, MESITA-543");
});

Deno.test("validateProjectPatch: rejects a monthly_promo_cap outside the legal set", () => {
  assert(!validateProjectPatch({ monthly_promo_cap: 750 }).ok);
});

Deno.test("validateProjectPatch: rejects strike_count outside 0..3", () => {
  assert(!validateProjectPatch({ strike_count: 4 }).ok);
  assert(!validateProjectPatch({ strike_count: -1 }).ok);
});

Deno.test("validateProjectPatch: rejects a malformed check_pin", () => {
  assert(!validateProjectPatch({ check_pin: "12345" }).ok, "5 digits");
  assert(!validateProjectPatch({ check_pin: "abcdef" }).ok, "non-digits");
});

Deno.test("validateProjectPatch: rejects a malformed CFDI RFC / CP", () => {
  assert(!validateProjectPatch({ cfdi_rfc: "TOO-SHORT" }).ok);
  assert(!validateProjectPatch({ cfdi_cp: "640" }).ok);
});

Deno.test("validateProjectPatch: rejects a discount_cap_cents that is negative", () => {
  assert(!validateProjectPatch({ discount_cap_cents: -100 }).ok);
});

Deno.test("validateProjectPatch: rejects null on a NOT NULL boolean/enum", () => {
  assert(!validateProjectPatch({ segmentation_basic_enabled: null }).ok);
  assert(!validateProjectPatch({ plan: null }).ok);
});

// ── validateProfilePatch ────────────────────────────────────────────────────

Deno.test("validateProfilePatch: accepts a patch mixing places and projects fields, like the view's real callers send", () => {
  const res = validateProfilePatch({
    mesita_name: "El Nuevo Nombre",
    category: "cafe",
    status: "active",
    welcome_free_rate: 20,
  });
  assert(res.ok);
});

Deno.test("validateProfilePatch: still enforces each field's own rule regardless of which table it belongs to", () => {
  assert(!validateProfilePatch({ status: "deleted" }).ok, "bad projects field");
  assert(!validateProfilePatch({ price_level: 9 }).ok, "bad places field");
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

Deno.test("writePlace: an invalid places patch never reaches the DB", async () => {
  const admin = unreachableAdmin();
  // Simulates the same Belt 1 bypass consumer-doc.test.ts documents: a real
  // caller decodes HTTP JSON as `unknown` and casts before calling the door.
  const invalidPatch = { price_level: 9 } as unknown as PlacePatch;
  const res = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: "11111111-1111-1111-1111-111111111111",
    patch: invalidPatch,
  });
  assert(!res.ok);
  assertEquals(res.error, "price_level must be between 1 and 4, or null");
});

Deno.test("writePlace: an invalid projects patch never reaches the DB", async () => {
  const admin = unreachableAdmin();
  const invalidPatch = { strike_count: 9 } as unknown as ProjectPatch;
  const res = await writePlace(admin, {
    table: "projects",
    mode: "update",
    id: "project-1",
    patch: invalidPatch,
  });
  assert(!res.ok);
  assertEquals(res.error, "strike_count must be an integer between 0 and 3");
});

Deno.test("writePlace: refuses to update google_place_id, before validation even runs", async () => {
  const admin = unreachableAdmin();
  const res = await writePlace(admin, {
    table: "places",
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

Deno.test("writePlace: places update writes exactly the validated patch, no select", async () => {
  const { admin, calls } = fakePlaceAdmin();
  const res = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: "place-1",
    patch: { instagram_followers_count: 3000 },
  });
  assert(res.ok);
  assertEquals(res.row, null);
  assertEquals(calls, [{ table: "places", op: "update", value: { instagram_followers_count: 3000 } }]);
});

Deno.test("writePlace: places insert with select returns the re-read row", async () => {
  const { admin } = fakePlaceAdmin({ row: { id: "place-1" } });
  const res = await writePlace(admin, {
    table: "places",
    mode: "insert",
    patch: { google_place_id: "ChIJ123", category: "cafe" },
    select: "id",
  });
  assert(res.ok);
  assertEquals(res.row, { id: "place-1" });
});

Deno.test("writePlace: projects insert carries the shared id alongside the patch", async () => {
  const { admin, calls } = fakePlaceAdmin({ row: { id: "place-1", slug: "cafe-central", status: "active" } });
  const res = await writePlace(admin, {
    table: "projects",
    mode: "insert",
    id: "place-1",
    patch: { slug: "cafe-central", status: "active", content_status: "ready" },
    select: "id, slug, status",
  });
  assert(res.ok);
  assertEquals(calls[0].value, {
    id: "place-1",
    slug: "cafe-central",
    status: "active",
    content_status: "ready",
  });
});

Deno.test("writePlace: places delete goes through .eq(id), not a bare table scan", async () => {
  const { admin, calls } = fakePlaceAdmin();
  const res = await writePlace(admin, { table: "places", mode: "delete", id: "place-1" });
  assert(res.ok);
  assertEquals(calls, [{ table: "places", op: "delete" }]);
});

Deno.test("writePlace: profiles update accepts a patch mixing both tables' fields", async () => {
  const { admin, calls } = fakePlaceAdmin();
  const res = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: "place-1",
    patch: { mesita_name: "Nuevo Nombre", status: "active" },
  });
  assert(res.ok);
  assertEquals(calls, [{
    table: "profiles",
    op: "update",
    value: { mesita_name: "Nuevo Nombre", status: "active" },
  }]);
});

Deno.test("writePlace: surfaces the Postgres error code for a unique-violation retry", async () => {
  const { admin } = fakePlaceAdmin({ errorCode: "23505" });
  const res = await writePlace(admin, {
    table: "places",
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
    table: "projects",
    mode: "update",
    id: "missing-project",
    patch: { status: "active" },
    select: "id",
    selectMode: "maybeSingle",
  });
  assert(res.ok);
  assertEquals(res.row, null);
});
