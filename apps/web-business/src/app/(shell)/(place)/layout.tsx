// The place surface — Profile · Reviews · Activity · Settings · Admin — for
// THE SELECTED PLACE (MESITA-1832). The address carries no id; the selection
// is the console's memory (lib/selected-place.ts). Everything else is the
// place layout MESITA-1537 mounted at /places/<id>: the 404 verdict, the
// holder, the tab set and the AdminPlace the ported sections read, resolved
// ONCE here so the heading, the rail and the page never re-derive them.
//
// NO PLACE YET: the organization holds nothing. The five rows stay in the
// rail (muted) and this layout answers each with the one next step — Add a
// place — instead of a page about nothing.
import { notFound, redirect } from "next/navigation";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { getManagePlace, getPlaceView, visibleTabs } from "@/lib/place-view";
import { getSelection } from "@/lib/selected-place";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { PublishOpenPlace } from "@/components/console/OpenPlace";
import { NoPlaceYet } from "@/components/console/NoPlaceYet";
import { isMemberPlan } from "@/components/place-manage/sections/promo-state";
import { PlaceManageShell } from "./PlaceManageShell";

export const dynamic = "force-dynamic";

export default async function SelectedPlaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  if (!user) redirect("/signin?next=/profile");
  const selection = await getSelection();
  if (!selection.placeId) {
    return <NoPlaceYet org={selection.org} />;
  }
  const id = selection.placeId;
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
  // for a pool place the rail learns the place exists at all.
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

  // Without a manage payload there is no PlaceContext to provide — and
  // nothing that needs one, since only Profile renders. A pool place has no
  // editable state to discard.
  if (!manage) {
    return (
      <>
        {publish}
        {heading}
        {children}
      </>
    );
  }
  return (
    <PlaceManageShell placeId={id} initialPlace={manage.place}>
      {publish}
      {heading}
      {children}
    </PlaceManageShell>
  );
}
