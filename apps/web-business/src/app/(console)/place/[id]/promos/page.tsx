import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Store } from "lucide-react";
import { PageErrorState } from "@/components/business/PageErrorState";
import { EmptyState } from "@/components/shared";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlaceOverview } from "@/lib/api/place";
import { listPlaceReservations } from "@/lib/api/reservations";
import { promosPath } from "@/lib/business-route-contract";
import { errMsg } from "@/lib/utils";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";
import { PromosClient } from "./PromosClient";

export const dynamic = "force-dynamic";

export default async function BusinessPromosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=${encodeURIComponent(promosPath(id))}`);

  let overview: Awaited<ReturnType<typeof getPlaceOverview>> | null = null;
  let overviewError: string | null = null;
  try {
    overview = await getPlaceOverview(supabase, id);
  } catch (err) {
    overviewError = errMsg(err, "Could not load your places.");
  }
  if (overviewError) {
    return (
      <PageErrorState
        heading="Couldn't load the place"
        message={overviewError}
        retryHref={promosPath(id)}
      />
    );
  }

  if (!overview || overview.places.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pt-2 pb-8 md:px-8 md:pt-4 md:pb-10">
          <EmptyState
            icon={<Store className="text-muted-foreground h-5 w-5" />}
            title="No place yet"
            description="Add a place to start configuring rewards."
            action={
              <Link href="/add" className={CTA_BUTTON_CLASS}>
                <Plus className="h-4 w-4" />
                Add place
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const active = overview.active?.place ?? overview.places[0];

  // The capability band. check_pin rides only on overview.active for owners
  // — never on the places[] rows — so a non-owner simply gets no card. The
  // reservation line is informational: if the call fails that block hides,
  // it never fails the page.
  const isOwner = (overview.active?.place ?? null)?.my_role === "owner";
  const checkPin =
    typeof overview.active?.place?.check_pin === "string"
      ? overview.active.place.check_pin
      : null;
  let placeLine: string | null = null;
  try {
    placeLine = (await listPlaceReservations(supabase, id, { limit: 1 })).lines
      .place;
  } catch (err) {
    console.error("[promos] business-web-list-reservations:", err);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-lg pb-6">
        <PromosClient
          place={active}
          rewardsConfig={overview.rewardsConfig}
          isOwner={isOwner}
          checkPin={checkPin}
          placeLine={placeLine}
        />
      </div>
    </div>
  );
}
