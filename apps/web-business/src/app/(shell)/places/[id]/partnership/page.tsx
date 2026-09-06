// Partnership — the plan this place is on, its rewards strategy, and the
// staff PIN capability band. Owner-gated controls inside the body render as
// explained locked states for org editors (autoplan D3), never dead buttons.
import { PageErrorState } from "@/components/business/PageErrorState";
import { getPlaceOverview } from "@/lib/api/place";
import { listPlaceReservations } from "@/lib/api/reservations";
import { errMsg } from "@/lib/utils";
import { PromosClient } from "@/app/(console)/place/[id]/promos/PromosClient";
import { assertActiveIsRoute, requireTab } from "../tab-guard";

export const dynamic = "force-dynamic";

export default async function PlacePartnershipTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireTab(id, "partnership");

  let overview: Awaited<ReturnType<typeof getPlaceOverview>> | null = null;
  try {
    overview = await getPlaceOverview(supabase, id);
  } catch (err) {
    return (
      <PageErrorState
        heading="Couldn't load Partnership"
        message={errMsg(err, "Could not load your places.")}
        retryHref={`/places/${id}/partnership`}
      />
    );
  }

  assertActiveIsRoute(overview?.active?.place?.id, id);
  const place = overview!.active!.place;

  // check_pin rides the owner branch only; has_pin is the member-visible
  // twin (MESITA-1537 E-H4), so a non-owner still learns the gate exists.
  const isOwner = place.my_role === "owner";
  const checkPin = typeof place.check_pin === "string" ? place.check_pin : null;

  let placeLine: string | null = null;
  try {
    placeLine = (await listPlaceReservations(supabase, id, { limit: 1 })).lines
      .place;
  } catch (err) {
    console.error("[partnership] business-web-list-reservations:", err);
  }

  return (
    <PromosClient
      place={place}
      rewardsConfig={overview!.rewardsConfig}
      isOwner={isOwner}
      checkPin={checkPin}
      placeLine={placeLine}
      basePath={`/places/${id}/partnership`}
    />
  );
}
