import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus, Store } from "lucide-react";
import { PageErrorState } from "@/components/business/PageErrorState";
import { EmptyState } from "@/components/shared";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { placePath, resolvePlaceTab } from "@/lib/business-route-contract";
import { errMsg } from "@/lib/utils";
import { EditVenueForm } from "../EditVenueForm";

export const dynamic = "force-dynamic";

export default async function BusinessPlaceTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tab: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id, tab: tabSegment } = await params;
  const sp = await searchParams;
  if (sp.tab) {
    redirect(placePath(id, resolvePlaceTab(sp.tab) ?? "preview"));
  }

  const tab = resolvePlaceTab(tabSegment);
  if (!tab) notFound();

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=${encodeURIComponent(placePath(id, tab))}`);

  let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
  let overviewError: string | null = null;
  try {
    overview = await getUnitOverview(supabase, id, 0);
  } catch (err) {
    overviewError = errMsg(err, "Could not load your venues.");
  }
  if (overviewError) {
    return (
      <PageErrorState
        heading="Couldn't load your place"
        message={overviewError}
        retryHref={placePath(id, tab)}
      />
    );
  }

  if (!overview || overview.venues.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 pt-2 pb-8 md:px-8 md:pt-4 md:pb-10">
          <EmptyState
            icon={<Store className="text-muted-foreground h-5 w-5" />}
            title="No venue yet"
            description="Add a venue to start editing it."
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
        <EditVenueForm venue={active} tab={tab} />
      </div>
    </div>
  );
}
