import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { Topbar } from "@/components/manager/Topbar";
import { EmptyState } from "@/components/shared";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Performance is gated behind real analytics — the KPI tiles, retention
// cohorts, and revenue-by-tier charts depend on aggregation jobs that
// haven't shipped yet. Until then we render the standard shell + an
// EmptyState so the page stops feeling broken.

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

  return (
    <>
      <Topbar
        title="Performance"
        subtitle="Visits, revenue, and cohort trends"
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 pt-2 pb-10 md:px-8 md:pt-4 md:pb-14">
          <EmptyState
            icon={<BarChart3 className="text-muted-foreground h-5 w-5" />}
            title="Performance is on the way"
            description="Daily visits, cohort retention, and revenue-by-tier charts ship once the analytics pipeline lands. We'll surface them here automatically."
          />
        </div>
      </div>
    </>
  );
}
