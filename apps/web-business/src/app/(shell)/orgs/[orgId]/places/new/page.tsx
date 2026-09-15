// Add place — a SEARCH, under its organization (MESITA-1813; rebuilt
// MESITA-1850).
//
// Pato, 2026-09-14: "make full width bar with the actual word engine. display
// if the place is already on mesita or if its not. and put the shitty button
// to claim/verify all the fucking workflow."
//
// So the page is a bar and a list, and every row carries both the answer and
// the verb. No Cancel: the breadcrumb and the rail are how you leave, and a
// Cancel pill under a search box is a form's habit, not a screen's need.
// Owner-only Create/Claim. No catalogue table, no OTP.
import { AddPlaceForm } from "@/components/add-place/AddPlaceForm";
import { canAddPlace } from "@/lib/active-organization";
import { requireOrg } from "@/lib/org-scope";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AddPlacePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createServerSupabase();
  const org = await requireOrg(supabase, orgId);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Add place
      </h1>
      <AddPlaceForm
        organizationId={org.id}
        canAdd={canAddPlace(org.myRole)}
        heldPlaceIds={org.places.map((p) => p.id)}
      />
    </>
  );
}
