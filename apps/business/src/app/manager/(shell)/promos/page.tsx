import Link from "next/link";
import { Plus, Store } from "lucide-react";
import { Topbar } from "@/components/manager/Topbar";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { PromosClient } from "./PromosClient";

// Server shell: loads the active venue (carries fiscal_type + current plan)
// and hands the client component everything it needs to render. Auth-gating
// already happens in middleware; we just resolve the unit overview here.
export const dynamic = "force-dynamic";

export default async function ManagerPromosPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const supabase = await createServerSupabase();
  const params = await searchParams;
  const requestedUnit = params.unit?.toString() ?? null;

  let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
  let overviewError: string | null = null;
  try {
    overview = await getUnitOverview(supabase, requestedUnit, 0);
  } catch (err) {
    overviewError =
      err instanceof Error ? err.message : "Could not load your venues.";
  }
  if (overviewError) {
    return (
      <>
        <Topbar
          title="Promos"
          subtitle="Plan, fiscal type, Welcome coupon, per-tier rates"
        />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
            <div className="border-destructive/40 bg-destructive/5 rounded-2xl border p-10 text-center">
              <h2 className="font-display text-destructive text-xl font-semibold tracking-tight">
                Couldn&apos;t load the venue
              </h2>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
                {overviewError}
              </p>
              <Link
                href="/manager/promos"
                className="bg-foreground text-background mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              >
                Try again
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!overview || overview.venues.length === 0) {
    return (
      <>
        <Topbar
          title="Promos"
          subtitle="Plan, fiscal type, Welcome coupon, per-tier rates"
        />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
            <div className="border-border bg-card rounded-2xl border border-dashed p-10 text-center">
              <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
                <Store className="text-muted-foreground h-5 w-5" />
              </div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                No venue to configure yet
              </h2>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
                Create your first venue, then come back here to pick a plan and
                set your cashback or discount rates.
              </p>
              <Link
                href="/manager/create_unit"
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
        subtitle="Promos — plan, fiscal type, Welcome coupon, and per-tier rates"
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
          <PromosClient venue={active} />
        </div>
      </div>
    </>
  );
}
