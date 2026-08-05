import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { PageErrorState } from "@/components/business/PageErrorState";
import { PerformanceClient } from "@/components/business/stats/PerformanceClient";
import { EmptyState } from "@/components/shared";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlacePerformance } from "@/lib/api/performance";
import { listPlaceReservations } from "@/lib/api/reservations";
import { getUnitOverview } from "@/lib/api/unit";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=/unit/${id}/performance`);

  // Overview + performance + reservations in parallel — the route id IS the
  // project id, so we don't need to wait on the overview to know what to fetch.
  const [overviewSettled, perfSettled, resSettled] = await Promise.allSettled([
    getUnitOverview(supabase, id, 0),
    getPlacePerformance(supabase, id),
    listPlaceReservations(supabase, id, { scope: "all", limit: 50 }),
  ]);

  if (overviewSettled.status === "rejected") {
    return (
      <PageErrorState
        heading="Couldn't load stats"
        message={errMsg(overviewSettled.reason, "Could not load your places.")}
        retryHref={`/unit/${id}/performance`}
      />
    );
  }

  const overview = overviewSettled.value;
  const active = overview.active?.place ?? overview.places[0] ?? null;

  if (!active) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 pt-1 pb-6">
          <EmptyState
            icon={<BarChart3 className="text-muted-foreground h-5 w-5" />}
            title="No place yet"
            description="Add a place to see performance stats."
          />
        </div>
      </div>
    );
  }

  // Prefetch used the route id. Only pass it through when that is the place
  // we render — otherwise the client re-fetches for active.id.
  const prefetchMatches = active.id === id;
  const initialData =
    prefetchMatches && perfSettled.status === "fulfilled"
      ? perfSettled.value
      : null;
  const initialError =
    prefetchMatches && perfSettled.status === "rejected"
      ? errMsg(perfSettled.reason, "Could not load performance.")
      : null;
  const initialReservations =
    prefetchMatches && resSettled.status === "fulfilled"
      ? resSettled.value
      : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-1 pb-6">
        <PerformanceClient
          projectId={active.id}
          initialData={initialData}
          initialError={initialError}
          initialReservations={initialReservations}
        />
      </div>
    </div>
  );
}
