import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { apiGetManagerProfile } from "@/lib/api/manager";

// Root smart-redirect.
//
//   no session         → /sign-in
//   not onboarded      → /onboard
//   no venues          → /add (create first venue)
//   venues exist       → /unit/<first venue id>/home
//
// The unit shell takes over from there; this page never renders UI.

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  let manager = null;
  try {
    manager = await apiGetManagerProfile(supabase);
  } catch (err) {
    console.error("[root] manager-profile:", err);
  }
  if (!manager?.full_name) redirect("/onboard");

  let overview = null;
  try {
    overview = await getUnitOverview(supabase, null, 0);
  } catch (err) {
    console.error("[root] manager-get-overview:", err);
  }
  const firstVenueId = overview?.venues?.[0]?.id;
  redirect(firstVenueId ? `/unit/${firstVenueId}/home` : "/add");
}
