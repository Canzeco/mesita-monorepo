import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleUser, PhoneCall } from "lucide-react";
import { PageErrorState } from "@/components/business/PageErrorState";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiListTeam, type TeamSnapshot } from "@/lib/api/team";
import { getPlaceOverview } from "@/lib/api/place";
import { listPlaceReservations } from "@/lib/api/reservations";
import { BUSINESS_ROUTES } from "@/lib/business-route-contract";
import { errMsg } from "@/lib/utils";
import { TeamClient } from "../team/TeamClient";
import { CheckPinCard } from "./CheckPinCard";

export const dynamic = "force-dynamic";

// "+16282960710" → "+1 (628) 296-0710"; anything non-NANP passes through.
function formatLine(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : e164;
}

// The per-place Settings tab (MESITA-843). Everything operational that used to
// claim its own tab collapses here: team, reservation line, and the owner-only
// Check PIN. Account-level billing stays at /settings — it belongs to the
// account, not to one place.
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

  // Overview carries owner-only check_pin on the active place. Reservation
  // line is informational — if it fails, that block just hides.
  const [teamSettled, overviewSettled, linesSettled] = await Promise.allSettled([
    apiListTeam(supabase, id),
    getPlaceOverview(supabase, id),
    listPlaceReservations(supabase, id, { limit: 1 }),
  ]);

  let initialSnapshot: TeamSnapshot | null = null;
  let initialError: string | null = null;
  if (teamSettled.status === "fulfilled") {
    initialSnapshot = teamSettled.value;
  } else {
    initialError = errMsg(teamSettled.reason, "Couldn't load the team.");
  }

  const overview =
    overviewSettled.status === "fulfilled" ? overviewSettled.value : null;
  if (overviewSettled.status === "rejected") {
    console.error(
      "[settings] business-web-get-overview:",
      overviewSettled.reason,
    );
  }
  // check_pin is attached only to overview.active for owners — never on the
  // places[] rows. Role can still come from the team snapshot if overview
  // degraded, so owners keep the card even when the PIN seed is missing.
  const activePlace = overview?.active?.place ?? null;
  const myRole =
    activePlace?.my_role ??
    overview?.places.find((p) => p.id === id)?.my_role ??
    initialSnapshot?.myRole ??
    null;
  const isOwner = myRole === "owner";
  const checkPin =
    typeof activePlace?.check_pin === "string" ? activePlace.check_pin : null;

  const placeLine =
    linesSettled.status === "fulfilled" ? linesSettled.value.lines.place : null;

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

        {isOwner ? (
          <CheckPinCard projectId={id} initialPin={checkPin} />
        ) : null}

        {placeLine ? (
          <section className="bg-card border-border flex items-start gap-3 rounded-2xl border p-4">
            <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
              <PhoneCall className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-foreground text-sm font-semibold">
                Mesita reservations line
              </h2>
              <p className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
                Mesita&apos;s reservation AI calls your place from{" "}
                <span className="text-foreground font-medium whitespace-nowrap">
                  {formatLine(placeLine)}
                </span>
                . It&apos;s also the number to call about any Mesita booking —
                save it so your team recognizes it.
              </p>
            </div>
          </section>
        ) : null}

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
