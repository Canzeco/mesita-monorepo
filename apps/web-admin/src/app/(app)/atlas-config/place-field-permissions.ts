// Place field edit rules — documents who may write each place profile field.
// Atlas Config renders these as prose, one sentence per field; the flags below
// are what that sentence is generated from.
//
// Rows are grouped by OWNERSHIP, so each block reads as one consistent
// writer/editor pattern instead of a checkerboard:
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
// Writer/editor contracts (shipped code, not a DB ACL):
//   Enricher  → research/analysis/contents pipeline writes to public.places
//   Admin     → Manage Single Unit Place UI (admin → business-web-update-project)
//   Business  → business Place editor + business-web-update-project whitelist/rejects
//
// Deliberately EXCLUDED (not Atlas profile spec): promo config
// (welcome/free/premium rates, monthly_promo_cap, segmentation toggles —
// Promos domain) and legacy text fields (pitch, story, vibe, currency,
// closes_at) that the EF still accepts but no current surface renders.
//
// Read-only in Atlas Config. Changing a flag here does not change permissions —
// update the Place UIs / EF / Enricher, then mirror it here.

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

export { PLACE_FIELD_PERMISSIONS } from "./place-field-permission-rows";

export { PLACE_FIELD_PERMISSION_GROUP_DESCRIPTIONS } from "./place-field-permission-metadata";
