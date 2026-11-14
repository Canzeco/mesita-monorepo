import { permanentRedirect } from "next/navigation";

// Retired sub-routes (the old search, create and enrich tabs) land on the
// one page. MUST stay the REQUIRED `[...slug]`: the index is a real page, and
// the optional form would collide with it.
export default function ManageMultipleLegacyRedirect() {
  permanentRedirect("/manage-multiple");
}
