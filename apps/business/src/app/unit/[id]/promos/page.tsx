import Link from "next/link";
import { Plus, Store } from "lucide-react";
import { PageErrorState } from "@/components/business/PageErrorState";
import { EmptyState } from "@/components/shared";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { errMsg } from "@/lib/utils";
import { PromosClient } from "./PromosClient";

export const dynamic = "force-dynamic";

export default async function BusinessPromosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const requestedUnit = id;

  let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
  let overviewError: string | null = null;
  try {
    overview = await getUnitOverview(supabase, requestedUnit, 0);
  } catch (err) {
    overviewError = errMsg(err, "Could not load your venues.");
  }
  if (overviewError) {
    return (
      <PageErrorState
        heading="Couldn't load the venue"
        message={overviewError}
        retryHref={`/unit/${id}/promos`}
      />
    );
  }

  if (!overview || overview.venues.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pt-2 pb-8 md:px-8 md:pt-4 md:pb-10">
          <EmptyState
            icon={<Store className="text-muted-foreground h-5 w-5" />}
            title="No venue yet"
            description="Add a venue to start configuring promos."
            action={
              <Link
                href="/add"
                className="bg-foreground text-background inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Add venue
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const active = overview.active?.venue ?? overview.venues[0];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-lg pb-6">
        <PromosClient venue={active} />
      </div>
    </div>
  );
}
