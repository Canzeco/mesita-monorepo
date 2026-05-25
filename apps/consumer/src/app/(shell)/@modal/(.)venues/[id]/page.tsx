import { createServerSupabase } from "@/lib/supabase/server";
import { apiGetVenue } from "@/lib/api/venues";
import { errMsg } from "@/lib/utils";
import { VenueDetailBody } from "@/components/consumer/VenueDetailBody";
import { VenueDetailModalShell } from "@/components/consumer/VenueDetailModalShell";

export const dynamic = "force-dynamic";

// Intercepted /venues/[id]. Fires only on soft navigation from inside
// (shell) — e.g. tapping a venue card in /discover/catalog. The underlying
// surface stays mounted; this renders inside the @modal slot on top.
//
// Hard navigation (refresh, direct URL, new tab) bypasses the interceptor
// and lands on src/app/(shell)/venues/[id]/page.tsx — the full page.

export default async function VenueModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  let venue: Awaited<ReturnType<typeof apiGetVenue>> = null;
  let fetchError: string | null = null;
  try {
    venue = await apiGetVenue(supabase, id);
  } catch (err) {
    fetchError = errMsg(err, "Couldn't load this venue.");
  }

  if (fetchError || !venue) {
    return (
      <VenueDetailModalShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <h2 className="font-display text-destructive text-2xl font-semibold tracking-tight">
            Couldn&apos;t load this venue
          </h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            {fetchError ?? "This venue may have been removed."}
          </p>
        </div>
      </VenueDetailModalShell>
    );
  }

  return (
    <VenueDetailModalShell>
      <VenueDetailBody venue={venue} />
    </VenueDetailModalShell>
  );
}
