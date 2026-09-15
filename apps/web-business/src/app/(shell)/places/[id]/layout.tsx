// The place surface — Profile · Reviews · Activity · Settings · Admin — for
// THE PLACE THE ADDRESS NAMES (MESITA-1839).
//
// THE ID IS BACK IN THE PATH, and the reason is the one MESITA-1807 already
// wrote down about `?org=`: scope that is not in the URL is scope the URL
// cannot carry. MESITA-1832 moved it into a cookie, which made three things
// stop working at once — a link to a place could not be sent to anyone, two
// browser tabs could not hold two places (a cookie is per-browser, so the
// second navigation in either tab rendered the other tab's place, on Profile
// an edit against the wrong record), and Back replayed a path whose meaning
// had since changed.
//
// The one-place console MESITA-1832 built is untouched: the rail still shows
// six words with no switcher and no id, and `/profile` still works typed by
// hand — it resolves the remembered place and forwards here. What changed is
// which of the two addresses is canonical. The rail links HERE, so a click
// still costs one hop; the flat address is for arrivals.
//
// This layout resolves the 404 verdict, the holder, the tab set and the
// AdminPlace ONCE, so the heading, the rail and the page never re-derive them.
//
// AND THE PAGES NO LONGER RE-FETCH THEM (MESITA-1875). "Once" was true of one
// REQUEST, which is not the same thing as once per navigation: `cache()`
// dedupes inside a request, a client navigation between siblings re-runs the
// page segment alone in a NEW request, and every view page opened with reads
// of its own that it used as a boolean and threw away. Measured in production:
// `business-web-get-overview` p50 472ms, p95 913ms — per tab click, for a
// fact this layout was holding. The matrix and the held flag travel down
// through `PlaceScope` now, `PlaceTabGate` does the refusing, and a view page
// reads nothing.
import { notFound, redirect } from "next/navigation";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { getManagePlace, getPlaceView, visibleTabs } from "@/lib/place-view";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { PublishOpenPlace } from "@/components/console/OpenPlace";
import { isMemberPlan } from "@/components/place-manage/sections/promo-state";
import { placeTabHref } from "@/lib/place-tabs";
import { PlaceTabGate } from "@/components/console/PlaceTabGate";
import { PlaceManageShell } from "./PlaceManageShell";
import { PlaceScopeProvider } from "./PlaceScope";

export const dynamic = "force-dynamic";

export default async function PlaceLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(placeTabHref(id, "profile"))}`);
  const supabase = await createServerSupabase();

  // Guard ORDER is load-bearing: `user` above, then `view`. Signed out,
  // get-place also fails, and answering 404 to someone who merely needs to
  // sign in would be both wrong and a worse experience. The two reads are
  // request-cached (lib/place-view.ts), so the page beneath asking again is
  // free.
  const [view, manage] = await Promise.all([
    getPlaceView(supabase, id).catch(() => null),
    getManagePlace(id),
  ]);
  if (!view) notFound();
  const tabs = visibleTabs(view, manage);

  // The rail renders above this layout and cannot know this place's NAME
  // or its VIEW SET; both are in hand, so they are published upward — and
  // for a pool place the rail learns the place exists at all. AppShell turns
  // the published id into the rail cookie, which is what makes the flat
  // addresses resolve here next time.
  const publish = (
    <PublishOpenPlace
      id={id}
      name={view.place.name}
      holderOrgId={view.holder?.organizationId ?? null}
      tabs={tabs}
    />
  );
  const heading = (
    <PlaceHeading
      name={view.place.name}
      verified={view.place.verified}
      listed={view.place.listed}
      partner={manage ? isMemberPlan(manage.place.plan) : false}
    />
  );

  // The matrix, the held flag, and — for a pool place only — the identity
  // payload its Profile renders. A HELD place gets `view: null`: everything
  // that screen draws comes through `PlaceContext`, and a second copy of a
  // record two providers both hold is how a screen starts disagreeing with
  // itself.
  const scope = {
    placeId: id,
    tabs,
    held: manage !== null,
    view: manage ? null : view,
  };

  // Without a manage payload there is no PlaceContext to provide — and
  // nothing that needs one, since only Profile renders. A pool place has no
  // editable state to discard.
  if (!manage) {
    return (
      <PlaceScopeProvider value={scope}>
        <PlaceTabGate />
        {publish}
        {heading}
        {children}
      </PlaceScopeProvider>
    );
  }
  return (
    <PlaceScopeProvider value={scope}>
      <PlaceTabGate />
      <PlaceManageShell placeId={id} initialPlace={manage.place}>
        {publish}
        {heading}
        {children}
      </PlaceManageShell>
    </PlaceScopeProvider>
  );
}
