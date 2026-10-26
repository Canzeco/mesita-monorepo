import type { PlaceTab } from "@/lib/place-tabs";

// THE MVP FIRST STAGE IS FIVE VIEWS (MESITA-2088, Reviews split out in
// MESITA-2183, Preview in MESITA-2231). Profile is the profile editor.
// Reviews reloads Google, Instagram, and Facebook and is not editable.
// Preview is the saved member place in a phone. Admin holds the facts and
// the Create/Enrich/Update buttons. Boost (MESITA-2789) shows the paid
// tier and every backing behind it, read-only.
export const FIRST_STAGE_TABS = ["profile", "reviews", "preview", "admin", "boost"] as const satisfies readonly PlaceTab[];
