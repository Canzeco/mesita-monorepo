import { redirect } from "next/navigation";
import { Topbar } from "@/components/manager/Topbar";
import { PageErrorState } from "@/components/manager/PageErrorState";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { apiGetVerification } from "@/lib/api/verifications";
import { VerifyForm } from "./VerifyForm";

// /unit/<id>/verify — ownership verification surface for a newly-claimed
// venue. The server fetches:
//   - the active venue (to show name + Google-listed phone + address)
//   - the manager's latest verification request for this venue
// and renders the client form. When the venue is already 'active' the
// manager doesn't need this page; we redirect to home.

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/unit/${id}/verify`);

  let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
  let overviewError: string | null = null;
  try {
    overview = await getUnitOverview(supabase, id, 0);
  } catch (err) {
    overviewError =
      err instanceof Error ? err.message : "Could not load this venue.";
  }
  if (overviewError) {
    return (
      <PageErrorState
        title="Verify ownership"
        subtitle="Confirm you operate this venue."
        heading="Couldn't load the venue"
        message={overviewError}
        retryHref={`/unit/${id}/verify`}
      />
    );
  }

  const venue = overview?.active?.venue ?? null;
  if (!venue) {
    return (
      <PageErrorState
        title="Verify ownership"
        subtitle="Confirm you operate this venue."
        heading="Venue not found"
        message="That venue doesn't exist or you don't have access to it."
        retryHref="/"
      />
    );
  }

  // Already verified → nothing to do here, skip ahead.
  if (venue.status === "active") {
    redirect(`/unit/${id}/home`);
  }

  const latest = await apiGetVerification(supabase, id);

  return (
    <>
      <Topbar
        title={venue.name}
        subtitle="Verify ownership — pick one method to confirm you operate this venue."
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pt-2 pb-10 md:px-8 md:pt-4 md:pb-14">
          <VerifyForm
            venue={{
              id: venue.id,
              name: venue.name,
              phone: venue.phone,
              address: venue.address,
            }}
            requesterEmail={user.email ?? ""}
            latest={latest}
          />
        </div>
      </div>
    </>
  );
}
