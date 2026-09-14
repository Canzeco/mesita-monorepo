// Menus — THE PLACE's menus, split out of Profile in MESITA-1848.
//
// The gate is the place's own: a URL is not a capability (the ONE matrix,
// lib/place-tabs). Menus sits with Profile and Reviews in the read set, so a
// viewer keeps the surface they already had when it was Profile's last card.
import { notFound } from "next/navigation";
import { getManagePlace, getPlaceView, visibleTabs } from "@/lib/place-view";
import { createServerSupabase } from "@/lib/supabase/server";
import { MenusTab } from "./MenusTab";

export const dynamic = "force-dynamic";

export default async function MenusPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = await createServerSupabase();
  const [view, manage] = await Promise.all([
    getPlaceView(supabase, id).catch(() => null),
    getManagePlace(id),
  ]);
  // Both reads are request-cached — the layout above already paid for them.
  if (!view || !manage || !visibleTabs(view, manage).includes("menus")) {
    notFound();
  }
  return <MenusTab />;
}
