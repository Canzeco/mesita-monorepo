import { redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { PageErrorState } from "@/components/business/PageErrorState";
import { ReservationsClient } from "@/components/business/stats/ReservationsClient";
import { EmptyState } from "@/components/shared";
import { createServerSupabase } from "@/lib/supabase/server";
import { listPlaceReservations } from "@/lib/api/reservations";
import { getUnitOverview } from "@/lib/api/unit";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReservationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=/unit/${id}/reservations`);

  const [overviewSettled, listSettled] = await Promise.allSettled([
    getUnitOverview(supabase, id, 0),
    listPlaceReservations(supabase, id, { scope: "all", limit: 50 }),
  ]);

  if (overviewSettled.status === "rejected") {
    return (
      <PageErrorState
        heading="Couldn't load reservations"
        message={errMsg(overviewSettled.reason, "Could not load your places.")}
        retryHref={`/unit/${id}/reservations`}
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
            icon={<CalendarCheck className="text-muted-foreground h-5 w-5" />}
            title="No place yet"
            description="Add a place before you can see Mesita reservations."
          />
        </div>
      </div>
    );
  }

  if (listSettled.status === "rejected") {
    return (
      <PageErrorState
        heading="Couldn't load reservations"
        message={errMsg(listSettled.reason, "Could not load bookings.")}
        retryHref={`/unit/${id}/reservations`}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-1 pb-6">
        <ReservationsClient data={listSettled.value} />
      </div>
    </div>
  );
}
