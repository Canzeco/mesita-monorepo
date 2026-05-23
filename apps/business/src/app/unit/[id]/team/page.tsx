import { redirect } from "next/navigation";
import { Topbar } from "@/components/manager/Topbar";
import { createServerSupabase } from "@/lib/supabase/server";
import { TeamClient } from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=/unit/${id}/team`);

  return (
    <>
      <Topbar title="Team" subtitle="Managers and waiters for this venue." />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-2 pb-10 md:px-8 md:pt-4 md:pb-14">
          <TeamClient venueId={id} currentUserId={user.id} />
        </div>
      </div>
    </>
  );
}
