// The Place surface: admin's Manage Single Place, mounted in the business
// console (MESITA-1537). Four tabs — Profile · Capabilities · Activity ·
// Admin — the same components the operator console uses.
//
// This layout is the ONE authority: it resolves the 404 verdict, the holder,
// the tab set, and the AdminPlace the ported sections read. Both loads are
// request-cached, so the tab page re-asking costs nothing.
import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getManagePlace, getPlaceView, visibleTabs } from "@/lib/place-view";
import { PlaceStateBadge } from "@/components/console/badges";
import { PlaceTabs } from "./PlaceTabs";
import { PlaceManageShell } from "./PlaceManageShell";

export const dynamic = "force-dynamic";

export default async function PlaceLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/places/${id}`)}`);

  let view: Awaited<ReturnType<typeof getPlaceView>>;
  try {
    view = await getPlaceView(supabase, id);
  } catch {
    // get-place answers 404 the same way for "does not exist" and "held by
    // an organization you are not in". This branch must not tell them apart.
    notFound();
  }

  // Null for a pool place: nobody holds it, so there is nothing to manage
  // yet — Profile carries the Claim button instead.
  const manage = await getManagePlace(id);
  const tabs = visibleTabs(view, manage);

  const header = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {view.place.name}
        </h1>
        {view.place.verified ? (
          <PlaceStateBadge state="verified" />
        ) : view.place.listed ? (
          <PlaceStateBadge state="listed" />
        ) : null}
      </div>
      {view.holder && (
        <p className="text-muted-foreground -mt-1 text-[13px]">
          Held by {view.holder.organizationName}
        </p>
      )}
      {tabs.length > 1 && <PlaceTabs placeId={id} tabs={tabs} />}
    </div>
  );

  // Without a manage payload there is no PlaceContext to provide — and
  // nothing that needs one, since only Profile renders.
  if (!manage) {
    return (
      <>
        {header}
        {children}
      </>
    );
  }

  return (
    <>
      {header}
      <PlaceManageShell placeId={id} initialPlace={manage.place}>
        {children}
      </PlaceManageShell>
    </>
  );
}
