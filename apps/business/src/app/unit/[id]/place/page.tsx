import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Store } from "lucide-react";
import { Topbar } from "@/components/manager/Topbar";
import { PageErrorState } from "@/components/manager/PageErrorState";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { EditVenueForm } from "./EditVenueForm";

export const dynamic = "force-dynamic";

export default async function ManagerPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/unit/${id}/place`);

  let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
  let overviewError: string | null = null;
  try {
    overview = await getUnitOverview(supabase, id, 0);
  } catch (err) {
    overviewError =
      err instanceof Error ? err.message : "Could not load your venues.";
  }
  if (overviewError) {
    return (
      <PageErrorState
        title="Place"
        subtitle="Edit the venue this unit is for."
        heading="Couldn't load your place"
        message={overviewError}
        retryHref={`/unit/${id}/place`}
      />
    );
  }

  if (!overview || overview.venues.length === 0) {
    return (
      <>
        <Topbar title="Place" subtitle="Edit the venue this unit is for." />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
            <div className="border-border bg-card rounded-2xl border border-dashed p-10 text-center">
              <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
                <Store className="text-muted-foreground h-5 w-5" />
              </div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                No venue to edit yet
              </h2>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
                Create your first venue, then come back here to fine-tune it.
              </p>
              <Link
                href="/add"
                className="bg-foreground text-background mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Create your first venue
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const active = overview.active?.venue ?? overview.venues[0];

  return (
    <>
      <Topbar
        title={active.name}
        subtitle="Place — edit catalog details, hours, photos."
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pt-2 pb-10 md:px-8 md:pt-4 md:pb-14">
          <EditVenueForm venue={active} />
        </div>
      </div>
    </>
  );
}
