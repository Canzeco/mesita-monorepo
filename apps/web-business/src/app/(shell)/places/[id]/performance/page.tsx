// Performance — the per-place record: summary, guest-produced stories and
// reviews, the notification feed, Reservationist bookings. Read-only, so
// org viewers keep it (autoplan D3).
import { PageErrorState } from "@/components/business/PageErrorState";
import { getPlaceOverview } from "@/lib/api/place";
import { getPlacePerformance } from "@/lib/api/performance";
import { listPlaceReservations } from "@/lib/api/reservations";
import { errMsg } from "@/lib/utils";
import { PerformanceClient } from "@/components/business/stats/PerformanceClient";
import { assertActiveIsRoute, requireTab } from "../tab-guard";

export const dynamic = "force-dynamic";

export default async function PlacePerformanceTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireTab(id, "performance");

  let overview: Awaited<ReturnType<typeof getPlaceOverview>> | null = null;
  const [overviewSettled, perfSettled, resSettled] = await Promise.allSettled([
    getPlaceOverview(supabase, id),
    getPlacePerformance(supabase, id),
    listPlaceReservations(supabase, id, { limit: 20 }),
  ]);

  if (overviewSettled.status === "rejected") {
    return (
      <PageErrorState
        heading="Couldn't load performance"
        message={errMsg(overviewSettled.reason, "Could not load your places.")}
        retryHref={`/places/${id}/performance`}
      />
    );
  }
  overview = overviewSettled.value;
  assertActiveIsRoute(overview?.active?.place?.id, id);

  return (
    <PerformanceClient
      projectId={id}
      initialData={perfSettled.status === "fulfilled" ? perfSettled.value : null}
      initialError={
        perfSettled.status === "rejected"
          ? errMsg(perfSettled.reason, "Could not load performance.")
          : null
      }
      initialReservations={
        resSettled.status === "fulfilled" ? resSettled.value : null
      }
    />
  );
}
