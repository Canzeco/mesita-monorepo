import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { Topbar } from "@/components/manager/Topbar";
import { EmptyState } from "@/components/shared";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Home is a placeholder until the dashboard surfaces (today's visits,
// cashback owed, cohort trends) are wired up. We still render the standard
// Topbar + container shell so the layout matches the rest of the manager
// console — the body is just an EmptyState explaining what will land here.

export default async function ManagerHomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=/unit/${id}/home`);

  return (
    <>
      <Topbar title="Home" subtitle="Your venue at a glance" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 pt-2 pb-10 md:px-8 md:pt-4 md:pb-14">
          <EmptyState
            icon={<LayoutDashboard className="text-muted-foreground h-5 w-5" />}
            title="Dashboard coming soon"
            description="Today's visits, cashback owed, and weekly cohort trends will land here once analytics is wired up. For now, hop into Promos to tune your rewards or Team to invite waiters."
          />
        </div>
      </div>
    </>
  );
}
