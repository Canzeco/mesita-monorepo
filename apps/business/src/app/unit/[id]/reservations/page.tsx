import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Topbar } from "@/components/business/Topbar";
import { PageErrorState } from "@/components/business/PageErrorState";
import { EmptyState } from "@/components/shared";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { apiListReservations } from "@/lib/api/reservations";
import { errMsg } from "@/lib/utils";
import { ReservationsClient } from "./ReservationsClient";

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

  let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
  let overviewError: string | null = null;
  try {
    overview = await getUnitOverview(supabase, id, 0);
  } catch (err) {
    overviewError = errMsg(err, "Couldn't load this unit.");
  }

  if (overviewError) {
    return (
      <PageErrorState
        title="Reservations"
        subtitle="Bookings from Mesita."
        heading="Couldn't load the venue"
        message={overviewError}
        retryHref={`/unit/${id}/reservations`}
      />
    );
  }

  if (!overview || overview.venues.length === 0) {
    return (
      <>
        <Topbar title="Reservations" subtitle="Bookings from Mesita." />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
            <EmptyState
              icon={<CalendarClock className="text-muted-foreground h-5 w-5" />}
              title="No venue available"
              description="Add or select a venue to see its reservations."
            />
          </div>
        </div>
      </>
    );
  }

  const active = overview.active?.venue ?? overview.venues[0];
  let initialReservations: Awaited<ReturnType<typeof apiListReservations>> = [];
  let reservationsError: string | null = null;
  try {
    initialReservations = await apiListReservations(supabase, {
      venueId: active.id,
      scope: "upcoming",
    });
  } catch (err) {
    reservationsError = errMsg(err, "Couldn't load reservations.");
  }

  if (reservationsError) {
    return (
      <PageErrorState
        title={active.name}
        subtitle="Reservations"
        heading="Couldn't load reservations"
        message={reservationsError}
        retryHref={`/unit/${id}/reservations`}
      />
    );
  }

  return (
    <>
      <Topbar
        title={active.name}
        subtitle="Reservations · confirm or decline"
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-lg flex-col px-4 pt-1 pb-14 md:px-5 md:pt-3 md:pb-16">
          <ReservationsClient
            venueId={active.id}
            initialReservations={initialReservations}
          />
        </div>
      </div>
    </>
  );
}
