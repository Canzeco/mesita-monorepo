// Settings — THE PLACE's switches: what a guest can do here.
//
// MEMBERS USED TO BE ON THIS PAGE (MESITA-1832: "the place's switches · the
// organization's Members"). It moved to `/orgs/<id>/members` in MESITA-1839.
// One page about two different nouns is a page that cannot be addressed:
// whose settings is `/settings`? The place's switches belong to the place and
// travel with it; who may sign in belongs to the organization and outlives
// every place it holds.
import { notFound } from "next/navigation";
import { getManagePlace, getPlaceView, visibleTabs } from "@/lib/place-view";
import { createServerSupabase } from "@/lib/supabase/server";
import { SettingsTab } from "./SettingsTab";

export const dynamic = "force-dynamic";

export default async function SettingsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = await createServerSupabase();
  const [view, manage] = await Promise.all([
    getPlaceView(supabase, id).catch(() => null),
    getManagePlace(id),
  ]);
  // A URL is not a capability. The rail offers this row to owners and editors
  // only; a viewer who types the address is refused here too (the ONE matrix,
  // lib/place-tabs). Both reads are request-cached — the layout already paid.
  if (!view || !manage || !visibleTabs(view, manage).includes("settings")) {
    notFound();
  }
  return <SettingsTab />;
}
