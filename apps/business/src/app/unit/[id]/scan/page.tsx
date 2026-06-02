import { redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { Topbar } from "@/components/business/Topbar";
import { PageErrorState } from "@/components/business/PageErrorState";
import { EmptyState } from "@/components/shared";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { apiListTickets } from "@/lib/api/tickets";
import { errMsg } from "@/lib/utils";
import { TicketsClient } from "../tickets/TicketsClient";

export const dynamic = "force-dynamic";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=/unit/${id}/scan`);

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
        title="Scan"
        subtitle="Business can also check tickets."
        heading="Couldn't load the venue"
        message={overviewError}
        retryHref={`/unit/${id}/scan`}
      />
    );
  }

  if (!overview || overview.venues.length === 0) {
    return (
      <>
        <Topbar title="Scan" subtitle="Business can also check tickets." />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
            <EmptyState
              icon={<ReceiptText className="text-muted-foreground h-5 w-5" />}
              title="No venue available"
              description="Add or select a venue to check tickets."
            />
          </div>
        </div>
      </>
    );
  }

  const active = overview.active?.venue ?? overview.venues[0];
  let initialTickets: Awaited<ReturnType<typeof apiListTickets>> = [];
  let ticketsError: string | null = null;
  try {
    initialTickets = await apiListTickets(supabase, {
      venueId: active.id,
      limit: 40,
    });
  } catch (err) {
    ticketsError = errMsg(err, "Couldn't load tickets.");
  }

  if (ticketsError) {
    return (
      <PageErrorState
        title={active.name}
        subtitle="Scan"
        heading="Couldn't load tickets"
        message={ticketsError}
        retryHref={`/unit/${id}/scan`}
      />
    );
  }

  return (
    <>
      <Topbar title={active.name} subtitle="Scan" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-2 pb-10 md:px-8 md:pt-4 md:pb-14">
          <TicketsClient venueId={active.id} initialTickets={initialTickets} />
        </div>
      </div>
    </>
  );
}
