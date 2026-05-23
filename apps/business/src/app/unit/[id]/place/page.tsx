import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Store } from "lucide-react";
import { Topbar } from "@/components/manager/Topbar";
import { PageErrorState } from "@/components/manager/PageErrorState";
import { EmptyState } from "@/components/shared";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { errMsg } from "@/lib/utils";
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
  if (!user) redirect(`/?next=/unit/${id}/place`);

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
        title="Place"
        heading="Couldn't load your place"
        message={overviewError}
        retryHref={`/unit/${id}/place`}
      />
    );
  }

  if (!overview || overview.venues.length === 0) {
    return (
      <>
        <Topbar title="Place" />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 pt-2 pb-10 md:px-8 md:pt-4 md:pb-14">
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
      </>
    );
  }

  const active = overview.active?.venue ?? overview.venues[0];

  return (
    <>
      <Topbar title={active.name} subtitle="Place" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pt-2 pb-10 md:px-8 md:pt-4 md:pb-14">
          <EditVenueForm venue={active} />
        </div>
      </div>
    </>
  );
}
