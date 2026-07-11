// Place field edit matrix — documents who may write each place profile field.
//
// Source of truth for this table is shipped code, not a DB ACL:
//   Native    → the Google Places seed at create time (createMinimalPlace
//               persists the GoogleBasics identity spine)
//   Enricher  → the cron pipeline (supabase-cron-enrich-place-*) — discovery,
//               synthesis, and the contents-stage persist
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
    note: "Business locks to Google; admin may correct. Seeded from Google, refreshed on enrich.",
    native: true,
    enricher: true,
    admin: true,
    business: false,
  },
  {
    key: "category",
    label: "Category",
    group: "Basics",
    note: "Seed lands 'undefined'; the Enricher infers the slug, business picker may correct. Admin Place UI is read-only.",
    native: false,
    enricher: true,
    admin: false,
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
    enricher: true,
    admin: false,
    business: false,
  },

  // ── Location ────────────────────────────────────────────────────────────
  {
    key: "address",
    label: "Address",
    group: "Location",
    note: "Google Places seed + Enricher refresh; EF rejects manual writes.",
    native: true,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "lat_lng",
    label: "Lat / Lng",
    group: "Location",
    note: "Not on the business-web-update-project whitelist.",
    native: true,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "zone_city",
    label: "Zone / City",
    group: "Location",
    note: "City from the Google seed; zone filled by Enricher synthesis.",
    native: true,
    enricher: true,
    admin: false,
    business: false,
  },

  // ── Time ────────────────────────────────────────────────────────────────
  {
    key: "hours",
    label: "Hours",
    group: "Time",
    native: true,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "timezone",
    label: "Timezone",
    group: "Time",
    note: "Shown read-only beside hours; Google sourced.",
    native: true,
    enricher: true,
    admin: false,
    business: false,
  },

  // ── Channels ────────────────────────────────────────────────────────────
  {
    key: "phone",
    label: "Phone",
    group: "Channels",
    note: "Enricher research stage may seed from Google; contents stage never overwrites contacts.",
    native: true,
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
    native: true,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "instagram_url",
    label: "Instagram",
    group: "Channels",
    note: "Enricher discovery + identity judge (lenient fallback).",
    native: true,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "facebook_url",
    label: "Facebook",
    group: "Channels",
    native: true,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "tiktok_url",
    label: "TikTok",
    group: "Channels",
    native: true,
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
    native: true,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "opentable_url",
    label: "OpenTable",
    group: "Channels",
    native: true,
    enricher: true,
    admin: true,
    business: true,
  },
  {
    key: "uber_eats_url",
    label: "Uber Eats",
    group: "Channels",
    native: true,
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
    note: "Google seed at create; Enricher vision funnel re-ranks and re-selects.",
    native: true,
    enricher: true,
    admin: true,
    business: true,
  },

  // ── Signals (machine-only) ──────────────────────────────────────────────
  {
    key: "google_stars_overall",
    label: "Google rating",
    group: "Signals",
    note: "Machine-only signal columns — never admin/business profile writes.",
    native: true,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "google_review_count",
    label: "Google review count",
    group: "Signals",
    native: true,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "instagram_followers_count",
    label: "Instagram followers",
    group: "Signals",
    note: "Apify scrape — Enricher only.",
    native: false,
    enricher: true,
    admin: false,
    business: false,
  },
  {
    key: "facebook_followers",
    label: "Facebook followers",
    group: "Signals",
    note: "Apify scrape — Enricher only.",
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
