import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/business/MobileFrame";
import { StatusBar } from "@/components/business/StatusBar";
import { UnitDock } from "@/components/business/UnitDock";
import { UnitChromeProvider } from "@/components/business/UnitChrome";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { apiGetBusinessProfile } from "@/lib/api/business";
import {
  ACTIVE_UNIT_COOKIE,
  resolveActiveUnitId,
} from "@/lib/active-unit";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [overviewResult, profileResult] = await Promise.allSettled([
    getUnitOverview(supabase, null, 0),
    apiGetBusinessProfile(supabase),
  ]);

  let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
  if (overviewResult.status === "fulfilled") {
    overview = overviewResult.value;
  } else {
    console.error("[console] business-get-overview:", overviewResult.reason);
  }

  const business =
    profileResult.status === "fulfilled" ? profileResult.value : null;
  const isSuperAdmin = overview?.isSuperAdmin === true;
  if (!isSuperAdmin && !business?.full_name) redirect("/onboard");

  const cookieStore = await cookies();
  const cookieUnitId = cookieStore.get(ACTIVE_UNIT_COOKIE)?.value ?? null;
  const venues = overview?.venues ?? [];
  const activeVenueId = resolveActiveUnitId({
    cookieId: cookieUnitId,
    venueIds: venues.map((v) => v.id),
  });

  return (
    <MobileFrame>
      <StatusBar />
      <UnitChromeProvider
        value={{
          activeVenueId,
          venues,
          isSuperAdmin,
        }}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
          <UnitDock />
        </div>
      </UnitChromeProvider>
    </MobileFrame>
  );
}
