// Place field edit matrix — documents who may write each place profile field.
//
// Native = the field is owned by the Google Places identity spine
// (createMinimalPlace seed + enrich-time refresh). Native fields are LOCKED:
// no editor — Enricher inference, Admin UI, or Business UI — may write them,
// so a native row always reads No / No / No. Non-native fields belong to
// Mesita and the per-role cells show who may write them:
//   Enricher  → the cron pipeline's own inference/synthesis writes
//   Admin     → Manage Single Unit Place UI (admin → business-web-update-project)
//   Business  → business Place editor + business-web-update-project whitelist/rejects
//
// Read-only in Atlas Config. Changing a cell here does not change permissions —
// update the Place UIs / EF / Enricher, then mirror the matrix.

export type FieldEditRole = "native" | "enricher" | "admin" | "business";

export type PlaceFieldPermission = {
  /** Stable key (matches places column or logical field). */
  key: string;
  /** Operator-facing label. */
  label: string;
  /** Grouping for the matrix (matches Place editor boxes). */
  group: "Basics" | "Location" | "Time" | "Channels" | "Media" | "Signals";
  /** Short note when a Yes/No needs context. */
  note?: string;
  native: boolean;
  enricher: boolean;
  admin: boolean;
  business: boolean;
};

export const PLACE_FIELD_PERMISSIONS: PlaceFieldPermission[] = [
  // ── Basics ──────────────────────────────────────────────────────────────
  {
    key: "name",
    label: "Name",
    group: "Basics",
    note: "Google identity spine — seeded at create, refreshed on enrich. No manual edits.",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },
  {
    key: "category",
    label: "Category",
    group: "Basics",
    note: "Seed lands 'undefined'; the Enricher infers the slug, admin/business may correct.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "tags",
    label: "Tags",
    group: "Basics",
    note: "Atlas catalog, max 20 per place. Inferred by the Enricher.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "description",
    label: "Description",
    group: "Basics",
    note: "About / description — synthesized by the Enricher, editable by admin/business.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "price_level",
    label: "Price",
    group: "Basics",
    note: "Google Places only — EF rejects manual writes.",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },

  // ── Location ────────────────────────────────────────────────────────────
  {
    key: "address",
    label: "Address",
    group: "Location",
    note: "Google-owned — seeded at create, refreshed on enrich; EF rejects manual writes.",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },
  {
    key: "lat_lng",
    label: "Lat / Lng",
    group: "Location",
    note: "Google-owned; not on the business-web-update-project whitelist.",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },
  {
    key: "zone_city",
    label: "Zone / City",
    group: "Location",
    note: "City from the Google seed; zone synthesized during enrich. No manual edits.",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },

  // ── Time ────────────────────────────────────────────────────────────────
  {
    key: "hours",
    label: "Hours",
    group: "Time",
    note: "Google seeds at create; Enricher refreshes; admin/business may correct.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "timezone",
    label: "Timezone",
    group: "Time",
    note: "Google sourced; shown read-only beside hours.",
    native: true,
    enricher: false,
    admin: false,
    business: false,
  },

  // ── Channels ────────────────────────────────────────────────────────────
  {
    key: "phone",
    label: "Phone",
    group: "Channels",
    note: "Enricher research stage may seed from Google; contents stage never overwrites contacts.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "email",
    label: "Email",
    group: "Channels",
    note: "Never written by the Enricher.",
    native: false,
    enricher: false,
    admin: true,
    business: true,
  },
  {
    key: "website_url",
    label: "Website",
    group: "Channels",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "instagram_url",
    label: "Instagram",
    group: "Channels",
    note: "Enricher discovery + identity judge (lenient fallback). Changing the account re-runs the Apify follower scrape.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "facebook_url",
    label: "Facebook",
    group: "Channels",
    note: "Changing the page re-runs the Apify follower/rating scrape.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "whatsapp_url",
    label: "WhatsApp",
    group: "Channels",
    note: "Not in the Enricher discovery set — Mesita input only.",
    native: false,
    enricher: false,
    admin: true,
    business: true,
  },
  {
    key: "google_maps_url",
    label: "Google Maps",
    group: "Channels",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "opentable_url",
    label: "OpenTable",
    group: "Channels",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "uber_eats_url",
    label: "Uber Eats",
    group: "Channels",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "menu_pdf_url",
    label: "Menu URL",
    group: "Channels",
    native: false,
    enricher: false,
    admin: true,
    business: true,
  },
  // ── Media ───────────────────────────────────────────────────────────────
  {
    key: "photos",
    label: "Photos",
    group: "Media",
    note: "Google seed at create; Enricher vision funnel re-ranks, admin/business curate.",
    native: false,
    enricher: true,
    admin: true,
    business: true,
  },

  // ── Signals (machine-only) ──────────────────────────────────────────────
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
];

export const PLACE_FIELD_PERMISSION_GROUPS = [
  "Basics",
  "Location",
  "Time",
  "Channels",
  "Media",
  "Signals",
] as const satisfies readonly PlaceFieldPermission["group"][];

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
