// Every tab page re-enforces its own row of the visibility matrix: the
// layout renders the tab row, but a URL is not a capability — someone can
// always type /places/<id>/settings. One helper, four call sites.
//
// It also carries the route-id guard's twin (autoplan E-A3): the tabs read
// business-web-get-overview, whose `active` falls back to places[0] when
// the requested id is not a membership. Any tab that renders overview data
// must assert active.id === routeId or it would silently show — and mutate
// — a different place.

import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlaceView, visibleTabs, type PlaceTab } from "@/lib/place-view";
import type { ConsolePlaceView } from "@/lib/api/organizations";

export async function requireTab(
  placeId: string,
  tab: PlaceTab,
): Promise<{ supabase: SupabaseClient; view: ConsolePlaceView }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/places/${placeId}/${tab}`)}`);
  }

  let view: ConsolePlaceView;
  try {
    view = await getPlaceView(supabase, placeId);
  } catch {
    notFound();
  }
  if (!visibleTabs(view).includes(tab)) notFound();
  return { supabase, view };
}

/** The overview payload's active place must BE the route's place. */
export function assertActiveIsRoute(
  activeId: string | undefined,
  routeId: string,
): void {
  if (activeId !== routeId) notFound();
}
