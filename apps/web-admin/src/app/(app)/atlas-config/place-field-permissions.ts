// Place field edit matrix — documents who may write each place profile field.
//
// Rows are grouped by OWNERSHIP, so each block reads as one consistent
// Yes/No pattern instead of a checkerboard:
//
//   Google native → owned by the Google identity spine (createMinimalPlace
//                   seed + re-stamped on every enrich). Where a manual edit
//                   is allowed, the next enrich overwrites it.
//   Enriched      → discovered/synthesized by the cron pipeline's own
//                   inference; admin/business may correct between runs.
//   Manual        → Mesita input only — the Enricher never writes these.
//   Signals       → machine-written metrics; read-only everywhere.
//   Lifecycle     → row state + billing, not profile content.
//
// Column contracts (shipped code, not a DB ACL):
//   Enricher  → research/analysis/contents pipeline writes to public.places
//   Admin     → Manage Single Unit Place UI (admin → business-web-update-project)
//   Business  → business Place editor + business-web-update-project whitelist/rejects
//
// Deliberately EXCLUDED (not Atlas profile spec): promo config
// (welcome/free/premium rates, monthly_promo_cap, segmentation toggles —
// Promos domain) and legacy text fields (pitch, story, vibe, currency,
// closes_at) that the EF still accepts but no current surface renders.
//
// Read-only in Atlas Config. Changing a cell here does not change permissions —
// update the Place UIs / EF / Enricher, then mirror the matrix.

export type FieldEditRole = "native" | "enricher" | "admin" | "business";

export type PlaceFieldPermission = {
  /** Stable key (matches places column or logical field). */
  key: string;
  /** Operator-facing label. */
  label: string;
  /** Ownership grouping — see header comment. */
  group: "Google native" | "Enriched" | "Manual" | "Signals" | "Lifecycle";
  /** Short note when a Yes/No needs context. */
  note?: string;
  native: boolean;
  enricher: boolean;
  admin: boolean;
  business: boolean;
};

export const PLACE_FIELD_PERMISSIONS: PlaceFieldPermission[] = [
  // ── Google native — seeded at create, re-stamped on every enrich ────────
  {
    key: "name",
    label: "Name",
    group: "Google native",
    note: "Editable in both Place UIs, but every enrich re-copies the Google name over manual corrections.",
    native: true,
    enricher: false,
    admin: true,
    business: true,
  },
  {
    key: "hours",
    label: "Hours",
    group: "Google native",
    note: "Google seeds and refreshes; admin/business may correct between enriches.",
    native: true,
    enricher: false,
    admin: true,
    business: true,
  },
  {
    key: "google_maps_url",
    label: "Google Maps",
    group: "Google native",
    note: "Derived from the Google place id at create; EF rejects every manual write. Create without a Google Place ID is invalid.",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },
  {
    key: "price_level",
    label: "Price",
    group: "Google native",
    note: "Google Places only — the EF rejects manual writes.",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },
  {
    key: "address",
    label: "Address",
    group: "Google native",
    note: "EF rejects manual writes.",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },
  {
    key: "lat_lng",
    label: "Lat / Lng",
    group: "Google native",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },
  {
    key: "zone_city",
    label: "Zone / City",
    group: "Google native",
    note: "City from the Google seed; zone refined by Enricher synthesis.",
    native: true,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "timezone",
    label: "Timezone",
    group: "Google native",
    note: "Shown read-only beside hours.",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },

  // ── Enriched — pipeline inference, Mesita may correct ───────────────────
  {
    key: "category",
    label: "Category",
    group: "Enriched",
    note: "Seed lands 'undefined'; the Enricher infers the slug. Admin Place UI shows it read-only — only the business picker corrects it.",
    native: false,
    enricher: true,
    admin: false,
    business: true,
  },
  {
    key: "tags",
    label: "Tags",
    group: "Enriched",
    note: "Atlas catalog, max 20 per place. Inferred by the Enricher.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "description",
    label: "Description",
    group: "Enriched",
    note: "About / description — synthesized by the Enricher, editable by admin/business.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "photos",
    label: "Photos",
    group: "Enriched",
    note: "Google seed at create; Enricher vision funnel re-ranks, admin/business curate.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "phone",
    label: "Phone",
    group: "Enriched",
    note: "Enricher research stage may seed from Google; contents stage never overwrites contacts.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "website_url",
    label: "Website",
    group: "Enriched",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "instagram_url",
    label: "Instagram",
    group: "Enriched",
    note: "Enricher discovery + identity judge (lenient fallback). Changing the account re-runs the Apify follower scrape.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "facebook_url",
    label: "Facebook",
    group: "Enriched",
    note: "Changing the page re-runs the Apify follower/rating scrape.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "opentable_url",
    label: "OpenTable",
    group: "Enriched",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "uber_eats_url",
    label: "Uber Eats",
    group: "Enriched",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "tripadvisor_url",
    label: "TripAdvisor",
    group: "Enriched",
    note: "Enricher discovery resolves it; business EF accepts it; not in the admin channels UI.",
    native: false,
    enricher: true,
    admin: false,
    business: true,
  },
  {
    key: "yelp_url",
    label: "Yelp",
    group: "Enriched",
    note: "Enricher-only — not on the EF whitelist and not in the shared read projection, so no UI shows or edits it.",
    native: false,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "reservations",
    label: "Reservations",
    group: "Enriched",
    note: "Enricher selects a channel (phone / WhatsApp / Instagram) into products.reservations; an admin selector pick wins and re-enrich never clobbers it.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "profile_details",
    label: "Profile details",
    group: "Enriched",
    note: "Editorial summary, established year, executive chef + details JSON — synthesis-only, no manual edit surface.",
    native: false,
    enricher: true,
    admin: false,
    business: false,
  },

  // ── Manual — Mesita input only, never enriched ──────────────────────────
  {
    key: "email",
    label: "Email",
    group: "Manual",
    note: "Never written by the Enricher.",
    native: false,
    enricher: false,
    admin: true,
    business: true,
  },
  {
    key: "whatsapp_url",
    label: "WhatsApp",
    group: "Manual",
    note: "Not in the Enricher discovery set — phone-shaped Mesita input.",
    native: false,
    enricher: false,
    admin: true,
    business: true,
  },
  {
    key: "menu_pdf_url",
    label: "Menu URL",
    group: "Manual",
    note: "Business editor only (URL + display name); not in the admin Place UI.",
    native: false,
    enricher: false,
    admin: false,
    business: true,
  },
  {
    key: "secondary_urls",
    label: "X / Threads / Reddit / Resy / DiDi Food",
    group: "Manual",
    note: "Secondary channels — accepted by the EF whitelist, hidden in both Place UIs today.",
    native: false,
    enricher: false,
    admin: false,
    business: true,
  },

  // ── Signals — machine-written metrics, read-only everywhere ─────────────
  {
    key: "google_stars_overall",
    label: "Google rating",
    group: "Signals",
    note: "Google-owned signal columns — refreshed on enrich, never manual.",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },
  {
    key: "google_review_count",
    label: "Google review count",
    group: "Signals",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },
  {
    key: "google_reviews",
    label: "Google reviews",
    group: "Signals",
    note: "Apify Google Maps scrape, capped at 100 reviews per run.",
    native: false,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "popular_times",
    label: "Popular times",
    group: "Signals",
    note: "Written during enrich when the gathered material supports it.",
    native: false,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "instagram_followers_count",
    label: "Instagram followers",
    group: "Signals",
    note: "Indirect only — follows the Instagram account; Apify refreshes on account change. Never typed.",
    native: false,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "facebook_followers",
    label: "Facebook followers",
    group: "Signals",
    note: "Indirect only — follows the Facebook page; Apify refreshes on account change. Never typed.",
    native: false,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "facebook_rating",
    label: "Facebook rating",
    group: "Signals",
    note: "Apify page scrape alongside followers.",
    native: false,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "mesita_ratings",
    label: "Mesita ratings",
    group: "Signals",
    note: "Consumer review aggregates (stars + counts) — columns reserved, no writer wired yet.",
    native: false,
    enricher: false,
    admin: false,
    business: false,
  },

  // ── Lifecycle — row state + billing, not profile content ────────────────
  {
    key: "status",
    label: "Status",
    group: "Lifecycle",
    note: "active / paused / archived — business sets it via the EF; admin Meta card shows it read-only.",
    native: false,
    enricher: false,
    admin: false,
    business: true,
  },
  {
    key: "content_status",
    label: "Enrichment status",
    group: "Lifecycle",
    note: "queued → generating → ready / failed — pipeline-owned lifecycle flag.",
    native: false,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "plan",
    label: "Plan",
    group: "Lifecycle",
    note: "Billing, not profile — the EF rejects it; changes only through the Stripe subscription flow.",
    native: false,
    enricher: false,
    admin: false,
    business: false,
  },
];

export const PLACE_FIELD_PERMISSION_GROUPS = [
  "Google native",
  "Enriched",
  "Manual",
  "Signals",
  "Lifecycle",
] as const satisfies readonly PlaceFieldPermission["group"][];

export const PLACE_FIELD_PERMISSION_GROUP_DESCRIPTIONS: Record<
  PlaceFieldPermission["group"],
  string
> = {
  "Google native":
    "Owned by the Google identity spine — seeded at create, re-stamped on every enrich.",
  Enriched:
    "Discovered or synthesized by the Enricher; Mesita may correct between runs.",
  Manual: "Mesita input only — the Enricher never writes these.",
  Signals: "Machine-written metrics — read-only everywhere.",
  Lifecycle: "Row state + billing, not profile content.",
};

export const PLACE_FIELD_EDIT_ROLES = [
  "native",
  "enricher",
  "admin",
  "business",
] as const satisfies readonly FieldEditRole[];

export const PLACE_FIELD_EDIT_ROLE_LABELS: Record<FieldEditRole, string> = {
  native: "Native",
  enricher: "Enricher",
  admin: "Admin",
  business: "Business",
};
