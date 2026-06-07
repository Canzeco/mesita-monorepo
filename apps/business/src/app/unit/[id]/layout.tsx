import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/business/MobileFrame";
import { StatusBar } from "@/components/business/StatusBar";
import { BottomNav } from "@/components/business/BottomNav";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import {
  apiGetBusinessProfile,
  type BusinessProfile,
} from "@/lib/api/business";

// Mobile-first venue console shell. The desktop sidebar is gone — the six
// operating surfaces (Place / Promos / Team / Scan / Performance /
// Settings) are reached through the BottomNav, and unit selection now
// lives on the Settings tab.
//
// Auth flow is unchanged:
//   - Require a Supabase session (middleware bounces signed-out users to /).
//   - Load the unit overview; its `isSuperAdmin` field decides whether to
//     enforce the onboarded-profile redirect (super-admins operate on
//     venues they don't own, so they have no businesses row).

export const dynamic = "force-dynamic";

export default async function BusinessShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [overviewResult, profileResult] = await Promise.allSettled([
    getUnitOverview(supabase, id, 0),
    apiGetBusinessProfile(supabase),
  ]);
  let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
  let business: BusinessProfile | null = null;
  if (overviewResult.status === "fulfilled") {
    overview = overviewResult.value;
  } else {
    console.error(
      "[business/(shell)] business-get-overview:",
      overviewResult.reason,
    );
  }
  if (profileResult.status === "fulfilled") {
    business = profileResult.value;
  } else if (!overview?.isSuperAdmin) {
    console.error("[business/(shell)] business-profile:", profileResult.reason);
  }

  const isSuperAdmin = overview?.isSuperAdmin === true;
  if (!isSuperAdmin && !business?.full_name) redirect("/onboard");

  return (
    <MobileFrame>
      <StatusBar />
      {/* Body: each page renders its own sticky Topbar + scrollable
          content. flex-1/min-h-0 lets the page's overflow-y-auto scroll
          inside the frame without pushing the BottomNav off-screen. */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      <BottomNav unitId={id} />
    </MobileFrame>
  );
}
