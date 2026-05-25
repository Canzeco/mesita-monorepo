import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiGetVenue } from "@/lib/api/venues";
import { errMsg } from "@/lib/utils";
import { VenueDetailBody } from "@/components/consumer/VenueDetailBody";

export const dynamic = "force-dynamic";

// Hard-nav landing for /venues/[id] (refresh, direct URL, new tab). When
// a user soft-navs from inside (shell) — e.g. tapping a card on
// /discover/catalog — they hit the intercepted variant at
// (shell)/@modal/(.)venues/[id]/page.tsx instead, which renders inside a
// modal on top of the underlying surface.

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  // apiGetVenue returns null on 404 and throws on real errors. Distinguish so
  // a transient backend hiccup doesn't render as "this venue doesn't exist."
  let venue: Awaited<ReturnType<typeof apiGetVenue>> = null;
  let fetchError: string | null = null;
  try {
    venue = await apiGetVenue(supabase, id);
  } catch (err) {
    fetchError = errMsg(err, "Couldn't load this venue.");
  }
  if (fetchError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <h2 className="font-display text-destructive text-2xl font-semibold tracking-tight">
          Couldn&apos;t load this venue
        </h2>
        <p className="text-muted-foreground max-w-sm text-sm">{fetchError}</p>
        <Link
          href="/discover/swipe"
          className="bg-foreground text-background mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold hover:opacity-90"
        >
          Back to discover
        </Link>
      </div>
    );
  }
  if (!venue) notFound();

  return (
    <div className="bg-background relative flex flex-1 flex-col overflow-y-auto">
      <Link
        href="/discover/swipe"
        className="absolute top-3 left-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-zinc-900 backdrop-blur transition hover:bg-white"
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <VenueDetailBody venue={venue} />
    </div>
  );
}
