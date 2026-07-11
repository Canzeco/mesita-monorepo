// Place field edit matrix — documents who may write each place profile field.
//
// Source of truth for this table is shipped code, not a DB ACL:
//   Native    → Google Places seed + Enricher pipeline writes to public.places
//   Admin     → Manage Single Unit Place UI (admin → business-web-update-project)
//   Business  → business Place editor + business-web-update-project whitelist/rejects
//   Consumer  → consumer app (place profiles are not consumer-writable today)
//
// Read-only in Atlas Config. Changing a cell here does not change permissions —
// update the Place UIs / EF / Enricher, then mirror the matrix.

export type FieldEditRole = "native" | "admin" | "business" | "consumer";

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
  admin: boolean;
  business: boolean;
  consumer: boolean;
};

export const PLACE_FIELD_PERMISSIONS: PlaceFieldPermission[] = [
  // ── Basics ──────────────────────────────────────────────────────────────
  {
    key: "name",
    label: "Name",
    group: "Basics",
    note: "Business locks to Google; admin may correct. Native seeds from Google.",
    native: true,
    admin: true,
    business: false,
    consumer: false,
  },
  {
    key: "category",
    label: "Category",
    group: "Basics",
    note: "Admin Place UI is read-only; business picker + Native ADEA write the slug.",
    native: true,
    admin: false,
    business: true,
    consumer: false,
  },
  {
    key: "tags",
    label: "Tags",
    group: "Basics",
    note: "Atlas catalog, max 20 per place.",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "description",
    label: "Description",
    group: "Basics",
    note: "About / description on the place profile.",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "price_level",
    label: "Price",
    group: "Basics",
    note: "Google Places only — EF rejects manual writes.",
    native: true,
    admin: false,
    business: false,
    consumer: false,
  },

  // ── Location ────────────────────────────────────────────────────────────
  {
    key: "address",
    label: "Address",
    group: "Location",
    note: "Native — Google Places seed + Enricher synthesis; EF rejects manual writes.",
    native: true,
    admin: false,
    business: false,
    consumer: false,
  },
  {
    key: "lat_lng",
    label: "Lat / Lng",
    group: "Location",
    note: "Not on the business-web-update-project whitelist.",
    native: true,
    admin: false,
    business: false,
    consumer: false,
  },
  {
    key: "zone_city",
    label: "Zone / City",
    group: "Location",
    note: "Filled by Native synthesis.",
    native: true,
    admin: false,
    business: false,
    consumer: false,
  },

  // ── Time ────────────────────────────────────────────────────────────────
  {
    key: "hours",
    label: "Hours",
    group: "Time",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "timezone",
    label: "Timezone",
    group: "Time",
    note: "Shown read-only beside hours; Native/Google sourced.",
    native: true,
    admin: false,
    business: false,
    consumer: false,
  },

  // ── Channels ────────────────────────────────────────────────────────────
  {
    key: "phone",
    label: "Phone",
    group: "Channels",
    note: "Native research may seed; contents stage never overwrites contacts.",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "email",
    label: "Email",
    group: "Channels",
    native: false,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "website_url",
    label: "Website",
    group: "Channels",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "instagram_url",
    label: "Instagram",
    group: "Channels",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "facebook_url",
    label: "Facebook",
    group: "Channels",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "tiktok_url",
    label: "TikTok",
    group: "Channels",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "whatsapp_url",
    label: "WhatsApp",
    group: "Channels",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "google_maps_url",
    label: "Google Maps",
    group: "Channels",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "opentable_url",
    label: "OpenTable",
    group: "Channels",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "uber_eats_url",
    label: "Uber Eats",
    group: "Channels",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "menu_pdf_url",
    label: "Menu URL",
    group: "Channels",
    native: false,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "whatsapp_pr_urls",
    label: "PR WhatsApp",
    group: "Channels",
    native: false,
    admin: true,
    business: true,
    consumer: false,
  },
  {
    key: "instagram_pr_urls",
    label: "PR Instagram",
    group: "Channels",
    native: false,
    admin: true,
    business: true,
    consumer: false,
  },

  // ── Media ───────────────────────────────────────────────────────────────
  {
    key: "photos",
    label: "Photos",
    group: "Media",
    native: true,
    admin: true,
    business: true,
    consumer: false,
  },

  // ── Signals (native-only) ───────────────────────────────────────────────
  {
    key: "google_stars_overall",
    label: "Google rating",
    group: "Signals",
    note: "Native-only signal columns — never business/admin/consumer profile writes.",
    native: true,
    admin: false,
    business: false,
    consumer: false,
  },
  {
    key: "google_review_count",
    label: "Google review count",
    group: "Signals",
    native: true,
    admin: false,
    business: false,
    consumer: false,
  },
  {
    key: "instagram_followers_count",
    label: "Instagram followers",
    group: "Signals",
    native: true,
    admin: false,
    business: false,
    consumer: false,
  },
  {
    key: "facebook_followers",
    label: "Facebook followers",
    group: "Signals",
    native: true,
    admin: false,
    business: false,
    consumer: false,
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
  "admin",
  "business",
  "consumer",
] as const satisfies readonly FieldEditRole[];

export const PLACE_FIELD_EDIT_ROLE_LABELS: Record<FieldEditRole, string> = {
  native: "Native",
  admin: "Admin",
  business: "Business",
  consumer: "Consumer",
};
