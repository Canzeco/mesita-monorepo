// Activity — THE ORGANIZATION's numbers.
//
// It was a PLACE view (`/places/<id>/activity`) from MESITA-1537 until
// MESITA-1841. Pato's 2026-09-14 drawing puts it flush-left with Payments and
// Credits, and that is the right scope: an operator asking "how are we doing"
// is asking about the business, not about one storefront.
//
// WHAT THE READ CAN ACTUALLY ANSWER. `business-web-get-performance` is
// place-scoped and there is no org-wide aggregate behind it — inventing one
// here would mean fanning out a read per place on every paint, or printing a
// total nobody computed. So the page is the organization's activity ONE PLACE
// AT A TIME, with a picker that only renders when there is a choice. For the
// one-place owner the console is built for, this is exactly the screen
// Activity always was, at a better address.
//
// WHICH PLACE: `?place=<id>` when the operator picked one, else the place the
// console remembers (the rail cookie), else the organization's first. A
// `?place=` naming a place this organization does not hold falls back rather
// than 404ing — the id in the query is a preference, not the page's subject.
//
// THE PAYMENTS LOG LIVES HERE (MESITA-1872). Pato: *"payments log go into
// activity."* It was the last strip on the catalogue, and it was the only
// thing on that page that was not a product: what guests paid and what
// reached the account is a READING, and this is the page an operator opens to
// read what happened. It is unbuilt, so it is a `SoonStrip` — never a fake
// feed and never a fake number.
//
// IT RENDERS IN EVERY STATE, the no-place one included. That is the state
// that most needs to say what is coming: an organization with nothing to
// show would otherwise meet a page with one card telling it to add a place
// and no hint that money will ever be reported here.
import { notFound, redirect } from "next/navigation";
import { NoPlaceYet } from "@/components/console/NoPlaceYet";
import { ErrorNote } from "@/components/ErrorNote";
import { PlaceActivity } from "@/components/place-manage/sections/PlaceActivity";
import { apiListOrganizations } from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";
import { orgHref } from "@/lib/console-routes";
import { getManagePlace } from "@/lib/place-view";
import { getSelection } from "@/lib/selected-place";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { ActivityPlacePicker } from "./ActivityPlacePicker";

export const dynamic = "force-dynamic";

export default async function OrgActivityPage(props: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgId }, sp] = await Promise.all([props.params, props.searchParams]);
  const user = await getServerUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(orgHref(orgId, "activity"))}`);
  }
  const supabase = await createServerSupabase();
  // The segment layout above already refused a foreign id; this read is for
  // the organization's places, which are the page's whole subject.
  const org = findOrg(await apiListOrganizations(supabase), orgId);
  if (!org) notFound();

  if (org.places.length === 0) {
    return (
      <>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Activity</h1>
        <NoPlaceYet org={org} />
        <SoonStrip {...SOON_STRIPS.payments} />
      </>
    );
  }

  const asked = typeof sp.place === "string" ? sp.place : null;
  const held = (id: string | null) =>
    id !== null && org.places.some((p) => p.id === id) ? id : null;
  // The console's memory is the fallback, so opening Activity lands on the
  // place you were just looking at rather than on whichever is alphabetically
  // first (`getSelection` is request-cached — the shell already paid).
  const remembered = held((await getSelection()).placeId);
  const placeId = held(asked) ?? remembered ?? org.places[0].id;
  const manage = await getManagePlace(placeId);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Activity</h1>
        <ActivityPlacePicker places={org.places} selectedId={placeId} />
      </div>
      {manage ? (
        <PlaceActivity place={manage.place} />
      ) : (
        <ErrorNote message="Couldn't load this place's numbers. Reload to try again." />
      )}
      {/* The payments log, at the foot: it is the organization's reading, so
          it sits UNDER the one place's numbers rather than above them. */}
      <SoonStrip {...SOON_STRIPS.payments} />
    </>
  );
}
