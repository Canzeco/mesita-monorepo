import { permanentRedirect } from "next/navigation";

// Every retired subpath of this page — config, triggers, calculator, playground —
// lands on the one page. The tabs became boxes on it, and the boxes are gone
// too (page.tsx), so there is no anchor left to preserve: every old deep link
// lands on the Soon page rather than on a fragment that no longer exists.
//
// MUST stay the REQUIRED `[...slug]`, never `[[...slug]]`: the index is a real
// page now, and the optional form would collide with it.
export default async function IntakeLegacyRedirect() {
  permanentRedirect("/enricher-config");
}
