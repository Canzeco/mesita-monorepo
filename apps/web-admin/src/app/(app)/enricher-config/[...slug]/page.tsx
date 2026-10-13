import { permanentRedirect } from "next/navigation";

// Retired subpaths — config, triggers, calculator, playground — land on
// Creation. /creation and /enrichment are real pages and win over this
// catch-all, so a bookmark to either half stays there.
//
// MUST stay the REQUIRED `[...slug]`, never `[[...slug]]`: the index is a real
// page now, and the optional form would collide with it.
export default async function CrenupLegacyRedirect() {
  permanentRedirect("/enricher-config/creation");
}
