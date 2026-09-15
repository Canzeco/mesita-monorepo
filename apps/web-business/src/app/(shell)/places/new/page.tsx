// Add place — a SEARCH, beside the catalogue (MESITA-1813; rebuilt
// MESITA-1850; moved to `/places/new` in MESITA-1892).
//
// Pato, 2026-09-14: "make full width bar with the actual word engine. display
// if the place is already on mesita or if its not. and put the shitty button
// to claim/verify all the fucking workflow."
//
// So the page is a bar and a list, and every row carries both the answer and
// the verb. No Cancel: the breadcrumb and the rail are how you leave, and a
// Cancel pill under a search box is a form's habit, not a screen's need.
//
// NO ROLE GATE, AND NO PLACE CAP. Both were the organization's: Create and
// Claim were owner-of-the-org, and MESITA-1879 refused a second place because
// `places.organization_id` could hold only one meaning per org. The column is
// gone and `claim_place(p_place_id, p_claimer)` mints the CLAIMER's own owner
// row, so a signed-in manager may claim from the pool and may hold as many
// places as they claim. This page therefore reads nothing before it renders:
// there is no membership to check.
import { AddPlaceForm } from "@/components/add-place/AddPlaceForm";
import { apiMyPlaces } from "@/lib/api/console";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SHELL_ROUTES } from "@/lib/console-routes";

export const dynamic = "force-dynamic";

export default async function AddPlacePage() {
  const user = await getServerUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(SHELL_ROUTES.placesNew)}`);
  }
  const supabase = await createServerSupabase();

  // The one read this page does need: which places the caller ALREADY holds,
  // so a result they own reads "Open" rather than offering a claim that would
  // 409. A failed read leaves the set empty, which costs a row the "you
  // already have this" label and nothing else — the EF still refuses.
  let heldPlaceIds: string[] = [];
  try {
    heldPlaceIds = (await apiMyPlaces(supabase)).map((p) => p.id);
  } catch (e) {
    console.error("[places/new] business-web-list-places:", e);
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Add place
      </h1>
      <AddPlaceForm heldPlaceIds={heldPlaceIds} />
    </>
  );
}
