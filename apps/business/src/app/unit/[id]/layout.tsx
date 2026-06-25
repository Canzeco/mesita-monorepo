import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/business/MobileFrame";
import { StatusBar } from "@/components/business/StatusBar";
import { UnitDock } from "@/components/business/UnitDock";
import { UnitChromeProvider } from "@/components/business/UnitChrome";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import {
  apiGetBusinessProfile,
  type BusinessProfile,
} from "@/lib/api/business";

// Mobile-first venue console shell:
//   Body   — page content (SubTabs stick under StatusBar)
//   Bottom — section tabs + logo / venues / profile

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
      <UnitChromeProvider
        value={{
          unitId: id,
          activeVenueId: id,
          venues: overview?.venues ?? [],
          isSuperAdmin,
        }}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
          <UnitDock unitId={id} />
        </div>
      </UnitChromeProvider>
    </MobileFrame>
  );
}
