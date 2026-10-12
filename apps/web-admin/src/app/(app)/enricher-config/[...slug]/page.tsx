import { permanentRedirect } from "next/navigation";
import { INTAKE_PARENT } from "../nav";

// Every subpath of this page — /creation and /enrichment (the MESITA-2083
// split, merged back into Intake by MESITA-2159) and the older config,
// triggers, calculator, playground — lands on the one page. Their sections
// are all on it, so there is no fragment to preserve.
//
// MUST stay the REQUIRED `[...slug]`, never `[[...slug]]`: the index is a real
// page, and the optional form would collide with it.
export default async function CrenupLegacyRedirect() {
  permanentRedirect(INTAKE_PARENT.href);
}
