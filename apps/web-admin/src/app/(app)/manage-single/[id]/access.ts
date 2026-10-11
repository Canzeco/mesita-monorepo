import type { PlaceTab } from "@/lib/place-tabs";

// THE MVP FIRST STAGE IS TWO VIEWS (MESITA-2088). Pato, 2026-10-10: "Admin
// manages the profiles in manage single." Profile is the profile editor;
// Admin holds the facts and the Create/Enrich/Update buttons. Every other view
// is Second Stage, deleted here, routes and pills.
export const FIRST_STAGE_TABS = ["profile", "admin"] as const satisfies readonly PlaceTab[];
