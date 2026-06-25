import { redirect } from "next/navigation";
import { PageErrorState } from "@/components/business/PageErrorState";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiListTeam, type TeamSnapshot } from "@/lib/api/team";
import { getUnitOverview } from "@/lib/api/unit";
import { errMsg } from "@/lib/utils";
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

  let initialSnapshot: TeamSnapshot | null = null;
  let initialWhatsappPrUrl = "";
  let initialInstagramPrUrl = "";
  let initialError: string | null = null;
  try {
    const [snapshot, overview] = await Promise.all([
      apiListTeam(supabase, id),
      getUnitOverview(supabase, id, 0),
    ]);
    initialSnapshot = snapshot;
    const venue =
      overview.active?.venue ??
      overview.venues.find((v) => v.id === id) ??
      overview.venues[0];
    if (venue) {
      initialWhatsappPrUrl = venue.whatsapp_pr_urls[0] ?? "";
      initialInstagramPrUrl = venue.instagram_pr_urls[0] ?? "";
    }
  } catch (err) {
    initialError = errMsg(err, "Couldn't load the team.");
  }

  if (!initialSnapshot) {
    return (
      <PageErrorState
        heading="Couldn't load the team"
        message={initialError ?? "No data returned."}
        retryHref={`/unit/${id}/team`}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-2 pb-8 md:px-8 md:pt-4 md:pb-10">
        <TeamClient
          venueId={id}
          currentUserId={user.id}
          initialSnapshot={initialSnapshot}
          initialWhatsappPrUrl={initialWhatsappPrUrl}
          initialInstagramPrUrl={initialInstagramPrUrl}
        />
      </div>
    </div>
  );
}
