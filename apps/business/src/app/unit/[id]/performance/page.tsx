import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { PageErrorState } from "@/components/business/PageErrorState";
import { EmptyState } from "@/components/shared";
import { createServerSupabase } from "@/lib/supabase/server";
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
        heading="Couldn't load stats"
        message={overviewError}
        retryHref={`/unit/${id}/performance`}
      />
    );
  }

  const active = overview?.active?.venue ?? overview?.venues[0] ?? null;

  if (!active) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 pt-1 pb-6">
          <EmptyState
            icon={<BarChart3 className="text-muted-foreground h-5 w-5" />}
            title="No venue yet"
            description="Add a venue to see performance stats."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-1 pb-6">
        <EmptyState
          icon={<BarChart3 className="text-muted-foreground h-5 w-5" />}
          title="Stats coming soon"
          description="Daily visits, retention, and revenue charts will show up here once the analytics pipeline lands."
        />
      </div>
    </div>
  );
}
