import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/business/MobileFrame";
import { StatusBar } from "@/components/business/StatusBar";
import { PlaceDock } from "@/components/business/PlaceDock";
import { PlaceChromeProvider } from "@/components/business/PlaceChrome";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlaceOverview } from "@/lib/api/place";
import { apiGetBusinessProfile } from "@/lib/api/business";
import { ACTIVE_PLACE_COOKIE, resolveActivePlaceId } from "@/lib/active-place";

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
    getPlaceOverview(supabase, null),
    apiGetBusinessProfile(supabase),
  ]);

  let overview: Awaited<ReturnType<typeof getPlaceOverview>> | null = null;
  if (overviewResult.status === "fulfilled") {
    overview = overviewResult.value;
  } else {
    console.error(
      "[console] business-web-get-overview:",
      overviewResult.reason,
    );
  }

  const business =
    profileResult.status === "fulfilled" ? profileResult.value : null;
  if (!business?.full_name) redirect("/onboard");

  const cookieStore = await cookies();
  const cookiePlaceId = cookieStore.get(ACTIVE_PLACE_COOKIE)?.value ?? null;
  const places = overview?.places ?? [];
  const activePlaceId = resolveActivePlaceId({
    cookieId: cookiePlaceId,
    projectIds: places.map((v) => v.id),
  });

  return (
    <MobileFrame>
      <StatusBar />
      <PlaceChromeProvider
        value={{
          activePlaceId,
          places,
        }}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
          <PlaceDock />
        </div>
      </PlaceChromeProvider>
    </MobileFrame>
  );
}
