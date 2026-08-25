import { permanentRedirect } from "next/navigation";

// The three retired tab routes — search, create, enrich — land on the one
// page. MUST stay the REQUIRED `[...slug]`: the index is a real page, and
// the optional form would collide with it.
export default function ManageMultipleLegacyRedirect() {
  permanentRedirect("/manage-multiple");
}
