// The Place surface's one authority (MESITA-1537, autoplan E-A4): this
// layout resolves the 404 verdict, the holder, and the TAB ROW for every
// place route; the tab pages re-read the same view through the
// request-cached getPlaceView (one EF call per request) and re-enforce
// their own row of the matrix — a URL is not a capability.
//
// Org context on place routes derives from the HOLDER, never from ?org=
// (E-H3): a multi-org user deep-linked here must see the org that actually
// holds the place.
import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlaceView, visibleTabs } from "@/lib/place-view";
import { PlaceTabs } from "./PlaceTabs";

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
    // get-place 404s uniformly for the invisible; anything else the page
    // itself reports. The layout only refuses what must never render.
    notFound();
  }

  const tabs = visibleTabs(view);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {view.place.name}
        </h1>
        {view.holder && (
          <p className="text-muted-foreground text-[13px]">
            Held by {view.holder.organizationName}
          </p>
        )}
      </div>
      {tabs.length > 1 && <PlaceTabs placeId={id} tabs={tabs} />}
      {children}
    </>
  );
}
