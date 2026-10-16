import type { PlaceTab } from "@/lib/place-tabs";

// THE MVP FIRST STAGE IS FOUR VIEWS (MESITA-2088, Reviews split out in
// MESITA-2183, Preview in MESITA-2231). Profile is the profile editor.
// Reviews reloads Google, Instagram, and Facebook and is not editable.
// Preview is the saved member place in a phone. Admin holds the facts and
// the Create/Enrich/Update buttons.
export const FIRST_STAGE_TABS = ["profile", "reviews", "preview", "admin"] as const satisfies readonly PlaceTab[];
