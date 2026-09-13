// Add place — the ceremony (MESITA-1813), under its organization.
// Search Google. On Mesita, add it to this organization. If it is not,
// create it, then add. Owner-only Create/Add. No catalogue table, no OTP.
import { AddPlaceForm } from "@/components/add-place/AddPlaceForm";
import { canAddPlace } from "@/lib/active-organization";
import { orgPlacesHref } from "@/lib/console-routes";
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
      <p className="text-muted-foreground -mt-2 text-sm">
        Search for the place. On Mesita, add it to this organization. If it is
        not, create it.
      </p>
      <AddPlaceForm
        organizationId={org.id}
        canAdd={canAddPlace(org.myRole)}
        heldPlaceIds={org.places.map((p) => p.id)}
        cancelHref={orgPlacesHref(org.id)}
      />
    </>
  );
}
