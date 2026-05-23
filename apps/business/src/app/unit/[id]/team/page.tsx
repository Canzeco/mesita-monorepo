import { redirect } from "next/navigation";
import { Topbar } from "@/components/manager/Topbar";
import { PageErrorState } from "@/components/manager/PageErrorState";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiListTeam, type TeamSnapshot } from "@/lib/api/team";
import { errMsg } from "@/lib/utils";
import { TeamClient } from "./TeamClient";

// Match Promos/Place: resolve everything the client needs on the server so
// the only loading indicator the user sees is the shared Suspense fallback
// in loading.tsx. Without this, TeamClient would mount empty and show its
// own "Loading team…" spinner on top of the centered shell loader.
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

  let initialSnapshot: TeamSnapshot | null = null;
  let initialError: string | null = null;
  try {
    initialSnapshot = await apiListTeam(supabase, id);
  } catch (err) {
    initialError = errMsg(err, "Couldn't load the team.");
  }

  if (!initialSnapshot) {
    return (
      <PageErrorState
        title="Team"
        subtitle="Managers and waiters for this venue."
        heading="Couldn't load the team"
        message={initialError ?? "No data returned."}
        retryHref={`/unit/${id}/team`}
      />
    );
  }

  return (
    <>
      <Topbar title="Team" subtitle="Managers and waiters for this venue." />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-2 pb-10 md:px-8 md:pt-4 md:pb-14">
          <TeamClient
            venueId={id}
            currentUserId={user.id}
            initialSnapshot={initialSnapshot}
          />
        </div>
      </div>
    </>
  );
}
