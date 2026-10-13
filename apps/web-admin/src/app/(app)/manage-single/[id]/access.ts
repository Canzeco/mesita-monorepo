import type { PlaceTab } from "@/lib/place-tabs";

// THE MVP FIRST STAGE IS THREE VIEWS (MESITA-2088, Reviews split out in
// MESITA-2183). Profile is the profile editor. Reviews reloads Google,
// Instagram, and Facebook and is not editable. Admin holds the facts and
// the Create/Enrich/Update buttons.
export const FIRST_STAGE_TABS = ["profile", "reviews", "admin"] as const satisfies readonly PlaceTab[];
