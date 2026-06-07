import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/business/MobileFrame";
import { StatusBar } from "@/components/business/StatusBar";
import { BottomNav } from "@/components/business/BottomNav";
import { UnitChromeProvider } from "@/components/business/UnitChrome";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import {
  apiGetBusinessProfile,
  type BusinessProfile,
} from "@/lib/api/business";

// Mobile-first venue console shell. The app bar (unit switcher + Settings +
// Profile) and the bottom nav (Place / Promos / Scan / Team / Stats) are the
// persistent chrome; unit data is fetched once here and shared via context.
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
      {/* Body: each page renders its own sticky app bar (Topbar) +
          scrollable content. flex-1/min-h-0 lets the page's overflow-y-auto
          scroll inside the frame without pushing the BottomNav off-screen.
          UnitChrome feeds the app bar's venue switcher. */}
      <UnitChromeProvider
        value={{
          unitId: id,
          activeVenueId: id,
          venues: overview?.venues ?? [],
          isSuperAdmin,
        }}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </UnitChromeProvider>
      <BottomNav unitId={id} />
    </MobileFrame>
  );
}
