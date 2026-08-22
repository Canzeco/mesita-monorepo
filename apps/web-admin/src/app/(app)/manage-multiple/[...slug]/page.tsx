import { permanentRedirect } from "next/navigation";

// The three retired tab routes — search, create, enrich — are sections on the
// one page now. MUST stay the REQUIRED `[...slug]`: the index is a real page,
// and the optional form would collide with it.
export default function ManageMultipleLegacyRedirect() {
  permanentRedirect("/manage-multiple");
}
