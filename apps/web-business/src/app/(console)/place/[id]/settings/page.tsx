import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleUser } from "lucide-react";
import { PageErrorState } from "@/components/business/PageErrorState";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiListTeam, type TeamSnapshot } from "@/lib/api/team";
import { BUSINESS_ROUTES } from "@/lib/business-route-contract";
import { errMsg } from "@/lib/utils";
import { TeamClient } from "../team/TeamClient";

export const dynamic = "force-dynamic";

// The per-place Settings tab (MESITA-843) — PEOPLE, not offerings (Pato live
// 2026-08-30). The Check PIN and the reservation line moved to Partnership,
// where what the place offers through Mesita is configured. Team stays here.
// Account-level billing stays at /settings — it belongs to the account, not
// to one place.
export default async function PlaceSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=/place/${id}/settings`);

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
        heading="Couldn't load settings"
        message={initialError ?? "No data returned."}
        retryHref={`/place/${id}/settings`}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-2 pb-8 md:px-8 md:pt-4 md:pb-10">
        <TeamClient
          projectId={id}
          currentUserId={user.id}
          initialSnapshot={initialSnapshot}
        />

        <Link
          href={BUSINESS_ROUTES.settings}
          className="bg-card border-border hover:bg-muted flex items-center gap-3 rounded-2xl border p-4 transition"
        >
          <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <CircleUser className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="text-foreground block text-sm font-semibold">
              Account &amp; billing
            </span>
            <span className="text-muted-foreground block text-[13px]">
              Partnership, payment method and sign-out — shared by every place on
              the account.
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
