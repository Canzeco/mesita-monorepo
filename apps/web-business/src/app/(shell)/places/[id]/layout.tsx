// The Place surface: admin's Manage Single Place, mounted in the business
// console (MESITA-1537). Four tabs — Profile · Capabilities · Activity ·
// Admin — the same components the operator console uses.
//
// This layout is the ONE authority: it resolves the 404 verdict, the holder,
// the tab set, and the AdminPlace the ported sections read. The heading and
// the rail both take that resolution rather than re-deriving any of it, so
// there is exactly one place that decides what this viewer may see.
import { notFound, redirect } from "next/navigation";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { getManagePlace, getPlaceView, placeTabHref, visibleTabs } from "@/lib/place-view";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { PublishOpenPlace } from "@/components/console/OpenPlace";
import { isMemberPlan } from "@/components/place-manage/sections/promo-state";
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

  // THREE round trips became one wait (MESITA-1729). The user check, the place
  // view and the manage payload are mutually independent — none reads another's
  // answer — but they were awaited on consecutive lines, so a tab click paid
  // them end to end. This layout is force-dynamic, so that was every click.
  //
  // Guard ORDER is load-bearing and must stay as written below: `user` is
  // checked before `view`. Signed out, get-place also fails, and answering 404
  // to someone who merely needs to sign in would be both wrong and a worse
  // experience. Checking user first keeps the old redirect.
  //
  // `getPlaceView` and `getManagePlace` are request-cached (lib/place-view.ts),
  // so the tab page below asking for the same data is still free.
  const [user, view, manage] = await Promise.all([
    getServerUser(),
    // get-place answers 404 the same way for "does not exist" and "held by
    // an organization you are not in". This branch must not tell them apart.
    getPlaceView(supabase, id).catch(() => null),
    // Null for a pool place: nobody holds it, so there is nothing to manage
    // yet — Profile carries the Claim button instead.
    getManagePlace(id),
  ]);
  // Bounce back to a real address, not the redirect (MESITA-1732):
  // /auth/post-signin pushes `next` straight through, so a bare place URL here
  // would cost the operator an extra hop after signing in.
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(placeTabHref(id, "profile"))}`);
  }
  if (!view) notFound();
  const tabs = visibleTabs(view, manage);

  // The rail needs this place's NAME and its VIEW SET, and it renders above
  // this layout, so it cannot know either. Publishing them upward costs
  // nothing — both are already in hand — where a second
  // `business-web-get-place` from the shell would cost a round trip on every
  // navigation. `tabs` is `visibleTabs()`, so the rail shows exactly the views
  // this viewer may open and never a disabled row.
  //
  // The unsaved-edits guard travels up too, but from further in: only
  // `PlaceNavBridge`, inside PlaceProvider, can read it.
  const publish = (
    <PublishOpenPlace
      id={id}
      name={view.place.name}
      owned={view.holder !== null}
      tabs={tabs}
    />
  );

  // ONE call site for the heading. Building it twice — once per branch — is
  // the drift this layout's docblock exists to prevent. It is a page title in
  // the content flow now, not a sticky bar: the rail is what stays.
  const heading = (
    <PlaceHeading
      name={view.place.name}
      verified={view.place.verified}
      listed={view.place.listed}
      partner={manage ? isMemberPlan(manage.place.plan) : false}
    />
  );

  // Without a manage payload there is no PlaceContext to provide — and
  // nothing that needs one, since only Profile renders. The bar still shows,
  // unguarded: a pool place has no editable state to discard.
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
