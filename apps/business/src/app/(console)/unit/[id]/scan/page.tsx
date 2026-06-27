import { redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";
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
        heading="Couldn't load the place"
        message={overviewError}
        retryHref={`/unit/${id}/scan`}
      />
    );
  }

  if (!overview || overview.places.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
          <EmptyState
            icon={<ReceiptText className="text-muted-foreground h-5 w-5" />}
            title="No place available"
            description="Add or select a place to check tickets."
          />
        </div>
      </div>
    );
  }

  const active = overview.active?.place ?? overview.places[0];
  let initialTickets: Awaited<ReturnType<typeof apiListTickets>> = [];
  let ticketsError: string | null = null;
  try {
    initialTickets = await apiListTickets(supabase, {
      projectId: active.id,
      limit: 100,
    });
  } catch (err) {
    ticketsError = errMsg(err, "Couldn't load tickets.");
  }

  if (ticketsError) {
    return (
      <PageErrorState
        heading="Couldn't load tickets"
        message={ticketsError}
        retryHref={`/unit/${id}/scan`}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 pt-1 pb-8 md:px-5 md:pt-3 md:pb-10">
        <TicketsClient
          projectId={active.id}
          placeCurrency={active.currency}
          initialTickets={initialTickets}
        />
      </div>
    </div>
  );
}
