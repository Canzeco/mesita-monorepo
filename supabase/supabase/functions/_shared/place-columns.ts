// Single source of truth for the columns we SELECT off public.places.
//
// Before this file existed, every EF that read places maintained its own
// hand-typed PLACE_COLUMNS string and they drifted: consumer EFs were missing
// the columns added by the Place redesign (timezone, hours, description,
// menu_pdf_url, tags, the signal
// fields, etc.), so consumers literally couldn't see what businesses had just
// edited. Importing from here keeps every read in lock-step.
//
// If you add a column to places, update this file once and every reader
// gets it.

const COLUMNS: readonly string[] = [
  "id",
  "slug",
  // Generated display column: coalesce(mesita_name, google_name). Read-only —
  // Postgres rejects any write. Every audience reads this one.
  "name",
  // Cached Google Places displayName. NOT an identity spine (google_place_id
  // is) — it changes whenever the Google listing does. Intaker-only write.
  // Guest profile chrome reads mesita_name, not this column.
  "google_name",
  // Mesita display label. Seeded at create from the first Google label;
  // operator-editable. NULL/empty ⇒ generated name follows google_name.
  "mesita_name",
  // `description_es` exists in DB (dormant) for a future Spanish TMS —
  // not selected until that ships (MESITA-939).
  "category",
  // Human-friendly category copy (emoji + natural-language label),
  // derived from category via place_categories.
  "category_label",
  // Super Categories inferred by contents enrichment. NULL until then.
  "family_keys",
  "vibe",
  "price_level",
  // ISO 4217 code (default MXN). Every monetary amount on a place —
  // price ranges shown on the consumer detail page, reward caps,
  // future cover charges — is denominated in this currency so the
  // client can render the right prefix ("MX$", "$", "€") without
  // hard-coding it.
  "currency",
  "listing_type",
  "status",
  "fiscal_type",
  "plan",
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
  // Four per-tier promo rates (free / premium). Welcome variants fire on a
  // guest's first visit at the place; the unprefixed variants apply on every
  // visit afterwards. Legal values: 10, 20, 30, 40, 50 (nullable).
  "welcome_free_rate",
  "welcome_premium_rate",
  "free_rate",
  "premium_rate",
  // Per-visit discount cap (independent of strategy), in the place's
  // currency. One of 200, 500, 1000 or null (Zero / no promo).
  "monthly_promo_cap",
  "photos",
  "menu_pdf_url",
  // Optional display name for menu_pdf_url, e.g. "Dinner menu" /
  // "Wine list". Null = consumer falls back to "Full menu" copy.
  "menu_pdf_name",
  "tags",
  // Channel URLs — primary, secondary, and PR. The Place page hides
  // secondary + PR for now but the values still round-trip through every
  // read and write, so they stay in the projection.
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
  "google_business_url",
  // Read-only signal columns — populated by enrichment, never by the
  // business. Shown on the Place page's Signals section and on consumer
  // surfaces that compare places.
  "google_stars_overall",
  "google_review_count",
  "google_visitor_count",
  "mesita_stars_overall",
  "mesita_stars_food",
  "mesita_stars_service",
  "mesita_stars_ambience",
  "mesita_stars_value",
  "mesita_review_count",
  "mesita_visitor_count",
  "instagram_followers_count",
  "facebook_rating",
  "facebook_followers",
  // Complete-place profile (migration 0039). Scalars + JSONB filled by the
  // one-run enricher; all nullable.
  "editorial_summary",
  "zone",
  "city",
  "established_year",
  "executive_chef",
  "discount_cap_cents",
  "details",
  // Generic product payload. Menus live under products.menu.
  "products",
  "google_reviews",
  "menus",
  "popular_times",
  "enriched_at",
  // Enrichment lifecycle (projects.content_status: queued | generating |
  // ready | failed). Stays 'generating' for the FULL pipeline
  // (research → analysis → contents); only contents lands 'ready'.
  // Public-safe — lets consumer surfaces show "(Enriching)" until done.
  "content_status",
  // Consumer Requests count. Progress toward Intake atlasRequestThreshold.
  // Requested is derived (count > 0 and content_status <> ready).
  "request_count",
  // Description/Actions (Intaker function 9) — guest Order / Reserve CTAs.
  "orders_enabled",
  "reservations_enabled",
  // Promos page section toggles. Boolean, business-controlled, persisted
  // so the on/off state survives page reloads.
  "segmentation_basic_enabled",
  "segmentation_advanced_enabled",
  "email",
  "created_at",
  // Promos v4 membership / strikes (MESITA-542) — projects columns exposed via
  // profiles. Readers that hit `places` directly simply won't see them.
  "first_ticket_honored_at",
  "plan_live_at",
  "strike_count",
  "last_strike_at",
  "promo_paused_until",
  "plan_forfeited_at",
  // Ghost-partner hold (MESITA-1311) — a lane input like the strike columns,
  // stripped for guests by BUSINESS_PRIVATE_PLACE_KEYS at the wire.
  "reward_lane_pending_review_at",
];

// Consumer reads — used by every public/consumer-facing EF. No `updated_at`
// because consumers don't need to see when the business last touched a row.
export const PLACE_PUBLIC_COLUMNS = COLUMNS.join(", ");

// The five enrichment-filled jsonb columns a LIST of places never needs —
// each is priced for one place read (a detail page), not N per request.
// place-card.ts (MESITA-1247 guard test 7 / MESITA-1283) proves a row
// stripped of these stays under the 50KB card budget even worst-case-stuffed.
export const PLACE_CARD_EXCLUDED_COLUMNS = new Set([
  "details",
  "products",
  "google_reviews",
  "menus",
  "popular_times",
]);

// The real card projection: every public column EXCEPT the five heavy jsonb
// ones. This is the source of truth place-card.ts's PlaceCard type mirrors —
// not a hand-picked subset. Any consumer surface returning MORE THAN ONE
// place per request (list, search, swipe/recommend) should select this, not
// PLACE_PUBLIC_COLUMNS; a single-place detail read (consumer-web-get-place)
// still wants the full projection, heavy columns included.
export const PLACE_CARD_COLUMNS_ARRAY: readonly string[] = COLUMNS.filter(
  (c) => !PLACE_CARD_EXCLUDED_COLUMNS.has(c),
);
export const PLACE_CARD_COLUMNS = PLACE_CARD_COLUMNS_ARRAY.join(", ");

// Order + reservation routing — which contact each rail reaches the place on
// (MESITA-1208; typed columns since routing left the products jsonb).
// BUSINESS-ONLY on purpose: a consumer never dials the place itself, so the
// selected endpoint stays out of the public payload even though it is usually
// just a copy of the already-public places.phone.
const ROUTING_COLUMNS: readonly string[] = [
  "reservation_channel",
  "reservation_target",
  "order_channel",
  "order_target",
];

// Operating (MESITA-1239) — what Google says about the business itself.
//
// BUSINESS-ONLY on purpose, for the same reason as the routing columns above:
// this is an OPERATOR fact, and its product consequence is deliberately
// undecided. Flag, never withhold — putting it in the public payload invites a
// consumer surface to gate on a third-party signal, which is precisely the
// auto-unlisting the issue argued against. Listed stays the visibility gate.
const OPERATING_COLUMNS: readonly string[] = [
  "business_status",
  "business_status_at",
];

// Business reads — includes `updated_at` so the business UI can show
// "saved · 2 min ago" style affordances, plus the routing columns the
// Settings rails edit and the Operating fact the Status box renders.
export const PLACE_BUSINESS_COLUMNS = [
  ...COLUMNS,
  ...ROUTING_COLUMNS,
  ...OPERATING_COLUMNS,
  "updated_at",
].join(", ");
