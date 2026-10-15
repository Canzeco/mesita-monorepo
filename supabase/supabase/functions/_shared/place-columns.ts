// Single source of truth for the columns we SELECT off public.place_profiles.
//
// Before this file existed, every EF that read place_profiles maintained its own
// hand-typed PLACE_PROFILE_COLUMNS string and they drifted: consumer EFs were missing
// the columns added by the Place redesign (timezone, hours, description,
// menu_pdf_url, tags, the signal
// fields, etc.), so consumers literally couldn't see what businesses had just
// edited. Importing from here keeps every read in lock-step.
//
// If you add a column to place_profiles, update this file once and every reader
// gets it.

const COLUMNS: readonly string[] = [
  "id",
  "slug",
  // Generated display column: coalesce(mesita_name, google_name). Read-only —
  // Postgres rejects any write. Every audience reads this one.
  "name",
  // Cached Google Places displayName. NOT an identity spine (google_place_id
  // is) — it changes whenever the Google listing does. Enricher-only write.
  // Guest profile chrome reads mesita_name, not this column.
  "google_name",
  // Mesita display label. Seeded at create from the first Google label;
  // operator-editable. NULL/empty ⇒ generated name follows google_name.
  "mesita_name",
  "category",
  // Human-friendly category copy (emoji + natural-language label),
  // derived from category via place_categories.
  "category_label",
  "price_level",
  // ISO 4217 code (default MXN). Every monetary amount on a place —
  // price ranges shown on the consumer detail page, future cover
  // charges — is denominated in this currency so the client can render
  // the right prefix ("MX$", "$", "€") without hard-coding it.
  "currency",
  "state",
  "lat",
  "lng",
  "address",
  "timezone",
  "closes_at",
  "hours",
  "phone",
  // Legacy text fields. Description superseded them on the redesigned
  // Place page, but other callers and the old consumer Info view still read
  // pitch / story so we keep them in the projection.
  "pitch",
  "story",
  "description",
  "photos",
  "menu_pdf_url",
  // Optional display name for menu_pdf_url, e.g. "Dinner menu" /
  // "Wine list". Null = consumer falls back to "Full menu" copy.
  "menu_pdf_name",
  "tags",
  // Channel URLs.
  "website_url",
  "instagram_url",
  "facebook_url",
  "whatsapp_url",
  "opentable_url",
  "resy_url",
  "uber_eats_url",
  "x_url",
  "threads_url",
  "reddit_url",
  "didi_food_url",
  "google_maps_url",
  // Read-only signal columns — populated by enrichment, never by the
  // business. Shown on the Place page's Signals section and on consumer
  // surfaces that compare place_profiles.
  "google_stars_overall",
  "google_review_count",
  "instagram_followers_count",
  "facebook_followers",
  // Complete-place profile (migration 0039). Scalars + JSONB filled by the
  // one-run enricher; all nullable.
  "zone",
  "city",
  // Generic product payload. Menus live under products.menu.
  "products",
  "google_reviews",
  "menus",
  "popular_times",
  // THE Enriched fact (MESITA-2154): set by the contents stage when an
  // Enrich run completes, never by Create. `isPlaceEnriched` reads it.
  "enriched_at",
  // Profile lifecycle (places.content_state: generating | ready | failed).
  // Create saves 'ready' (the profile can be shown — NOT enriched); an
  // Enrich run holds 'generating' for the FULL pipeline
  // (research → analysis → contents) and contents lands 'ready' again.
  // Public-safe — lets consumer surfaces show "(Enriching)" until done.
  "content_state",
  // Consumer Requests count. Progress toward Crenup atlasRequestThreshold.
  // Requested is derived (count > 0 and enriched_at null).
  "request_count",
  // Description/Actions (Enricher step 7) — the guest Reserve CTA.
  "reservations_enabled",
  "created_at",
];

// Consumer reads — used by every public/consumer-facing EF. No `updated_at`
// because consumers don't need to see when the business last touched a row.
export const PLACE_PUBLIC_COLUMNS = COLUMNS.join(", ");

// The four enrichment-filled jsonb columns a LIST of place_profiles never needs —
// each is priced for one place read (a detail page), not N per request.
// place-columns.test.ts (MESITA-1247 guard test 7 / MESITA-1283) proves a row
// stripped of these stays under the 50KB card budget even worst-case-stuffed.
const PLACE_CARD_EXCLUDED_COLUMNS = new Set([
  "products",
  "google_reviews",
  "menus",
  "popular_times",
]);

// The real card projection: every public column EXCEPT the four heavy
// jsonb ones — not a hand-picked subset. Any consumer surface returning
// MORE THAN ONE place per request (list, search, swipe/recommend) should
// select this, not PLACE_PUBLIC_COLUMNS; a single-place detail read
// (consumer-web-get-place) still wants the full projection, heavy columns
// included.
export const PLACE_CARD_COLUMNS_ARRAY: readonly string[] = COLUMNS.filter(
  (c) => !PLACE_CARD_EXCLUDED_COLUMNS.has(c),
);
export const PLACE_CARD_COLUMNS = PLACE_CARD_COLUMNS_ARRAY.join(", ");

// Reservation routing — which contact the rail reaches the place on
// (MESITA-1208; typed columns since routing left the products jsonb).
// BUSINESS-ONLY on purpose: a consumer never dials the place itself, so the
// selected endpoint stays out of the public payload even though it is usually
// just a copy of the already-public place_profiles.phone.
const ROUTING_COLUMNS: readonly string[] = [
  "reservation_channel",
  "reservation_target",
];

// Operating (MESITA-1239) — what Google says about the business itself.
//
// BUSINESS-ONLY on purpose, for the same reason as the routing columns above:
// this is an OPERATOR fact, and its product consequence is deliberately
// undecided. Flag, never withhold — putting it in the public payload invites a
// consumer surface to gate on a third-party signal, which is precisely the
// auto-unlisting the issue argued against. Listed stays the visibility gate.
const OPERATING_COLUMNS: readonly string[] = [
  "business_state",
  "business_state_at",
];

// Business reads — includes `updated_at` so the business UI can show
// "saved · 2 min ago" style affordances, plus the routing columns Single
// Place edits and the Operating fact the State box renders.
export const PLACE_BUSINESS_COLUMNS = [
  ...COLUMNS,
  ...ROUTING_COLUMNS,
  ...OPERATING_COLUMNS,
  "updated_at",
].join(", ");
