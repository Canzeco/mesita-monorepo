import type {
  FieldEditRole,
  PlaceFieldPermission,
} from "./place-field-permissions";

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
