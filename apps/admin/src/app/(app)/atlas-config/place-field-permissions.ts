// Place field edit matrix — documents who may write each place profile field.
//
// Source of truth for this table is shipped code, not a DB ACL:
//   Admin     → Manage Single Unit Place UI (admin → business-web-update-project)
//   Business  → business Place editor + business-web-update-project whitelist/rejects
//   Enricher  → research/analysis/contents pipeline writes to public.places
//
// Read-only in Atlas Config. Changing a cell here does not change permissions —
// update the Place UIs / EF / Enricher, then mirror the matrix.

export type FieldEditRole = "admin" | "business" | "enricher";

export type PlaceFieldPermission = {
  /** Stable key (matches places column or logical field). */
  key: string;
  /** Operator-facing label. */
  label: string;
  /** Grouping for the matrix (matches Place editor boxes). */
  group: "Basics" | "Location" | "Time" | "Channels" | "Media" | "Signals";
  /** Short note when a Yes/No needs context. */
  note?: string;
  admin: boolean;
  business: boolean;
  enricher: boolean;
};

export const PLACE_FIELD_PERMISSIONS: PlaceFieldPermission[] = [
  // ── Basics ──────────────────────────────────────────────────────────────
  {
    key: "name",
    label: "Name",
    group: "Basics",
    note: "Business locks to Google; admin may correct. Enricher seeds from Google.",
    admin: true,
    business: false,
    enricher: true,
  },
  {
    key: "category",
    label: "Category",
    group: "Basics",
    note: "Admin Place UI is read-only; business picker + Enricher ADEA write the slug.",
    admin: false,
    business: true,
    enricher: true,
  },
  {
    key: "tags",
    label: "Tags",
    group: "Basics",
    note: "Atlas catalog, max 20 per place.",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "description",
    label: "Description",
    group: "Basics",
    note: "About / description on the place profile.",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "price_level",
    label: "Price",
    group: "Basics",
    note: "Google Places only — EF rejects manual writes.",
    admin: false,
    business: false,
    enricher: true,
  },

  // ── Location ────────────────────────────────────────────────────────────
  {
    key: "address",
    label: "Address",
    group: "Location",
    note: "Business UI treats location as Google-synced; admin may edit address text.",
    admin: true,
    business: false,
    enricher: true,
  },
  {
    key: "lat_lng",
    label: "Lat / Lng",
    group: "Location",
    note: "Not on the business-web-update-project whitelist.",
    admin: false,
    business: false,
    enricher: true,
  },
  {
    key: "zone_city",
    label: "Zone / City",
    group: "Location",
    note: "Filled by Enricher synthesis.",
    admin: false,
    business: false,
    enricher: true,
  },

  // ── Time ────────────────────────────────────────────────────────────────
  {
    key: "hours",
    label: "Hours",
    group: "Time",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "timezone",
    label: "Timezone",
    group: "Time",
    note: "Shown read-only beside hours; Enricher/Google sourced.",
    admin: false,
    business: false,
    enricher: true,
  },

  // ── Channels ────────────────────────────────────────────────────────────
  {
    key: "phone",
    label: "Phone",
    group: "Channels",
    note: "Enricher research may seed; contents stage never overwrites contacts.",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "email",
    label: "Email",
    group: "Channels",
    admin: true,
    business: true,
    enricher: false,
  },
  {
    key: "website_url",
    label: "Website",
    group: "Channels",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "instagram_url",
    label: "Instagram",
    group: "Channels",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "facebook_url",
    label: "Facebook",
    group: "Channels",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "tiktok_url",
    label: "TikTok",
    group: "Channels",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "whatsapp_url",
    label: "WhatsApp",
    group: "Channels",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "google_maps_url",
    label: "Google Maps",
    group: "Channels",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "opentable_url",
    label: "OpenTable",
    group: "Channels",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "uber_eats_url",
    label: "Uber Eats",
    group: "Channels",
    admin: true,
    business: true,
    enricher: true,
  },
  {
    key: "menu_pdf_url",
    label: "Menu URL",
    group: "Channels",
    admin: true,
    business: true,
    enricher: false,
  },
  {
    key: "whatsapp_pr_urls",
    label: "PR WhatsApp",
    group: "Channels",
    admin: true,
    business: true,
    enricher: false,
  },
  {
    key: "instagram_pr_urls",
    label: "PR Instagram",
    group: "Channels",
    admin: true,
    business: true,
    enricher: false,
  },

  // ── Media ───────────────────────────────────────────────────────────────
  {
    key: "photos",
    label: "Photos",
    group: "Media",
    admin: true,
    business: true,
    enricher: true,
  },

  // ── Signals (enricher-only) ─────────────────────────────────────────────
  {
    key: "google_stars_overall",
    label: "Google rating",
    group: "Signals",
    note: "Enricher-only signal columns — never business/admin profile writes.",
    admin: false,
    business: false,
    enricher: true,
  },
  {
    key: "google_review_count",
    label: "Google review count",
    group: "Signals",
    admin: false,
    business: false,
    enricher: true,
  },
  {
    key: "instagram_followers_count",
    label: "Instagram followers",
    group: "Signals",
    admin: false,
    business: false,
    enricher: true,
  },
  {
    key: "facebook_followers",
    label: "Facebook followers",
    group: "Signals",
    admin: false,
    business: false,
    enricher: true,
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
