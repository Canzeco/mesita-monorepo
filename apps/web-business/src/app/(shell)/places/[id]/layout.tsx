// The Place surface: admin's Manage Single Place, mounted in the business
// console (MESITA-1537). Four tabs — Profile · Capabilities · Activity ·
// Admin — the same components the operator console uses.
//
// This layout is the ONE authority: it resolves the 404 verdict, the holder,
// the tab set, and the AdminPlace the ported sections read. PlaceBar takes all
// of it as props rather than re-resolving any of it, so there is exactly one
// place that decides what this viewer may see.
import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getManagePlace, getPlaceView, visibleTabs } from "@/lib/place-view";
import { resolveActiveOrg } from "@/lib/active-organization";
import { apiListOrganizations } from "@/lib/api/organizations";
import { PlaceBar } from "@/components/console/PlaceBar";
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

  // The org the tab hrefs must carry. A layout cannot read searchParams, so
  // it resolves the same way every page does: the holder when there is one,
  // else the caller's first organization.
  let organizationId = view.holder?.organizationId ?? null;
  if (!organizationId) {
    const orgs = await apiListOrganizations(supabase).catch(() => []);
    organizationId = resolveActiveOrg(orgs, undefined)?.id ?? null;
  }

  // ONE call site for the bar. Building it twice — once per branch — is the
  // drift this layout's docblock exists to prevent.
  const bar = (
    <PlaceBar
      placeId={id}
      name={view.place.name}
      tabs={tabs}
      organizationId={organizationId}
      verified={view.place.verified}
      listed={view.place.listed}
      guarded={manage !== null}
    />
  );

  // Without a manage payload there is no PlaceContext to provide — and
  // nothing that needs one, since only Profile renders. The bar still shows,
  // unguarded: a pool place has no editable state to discard.
  if (!manage) {
    return (
      <>
        {bar}
        {children}
      </>
    );
  }

  return (
    <PlaceManageShell placeId={id} initialPlace={manage.place} header={bar}>
      {children}
    </PlaceManageShell>
  );
}
