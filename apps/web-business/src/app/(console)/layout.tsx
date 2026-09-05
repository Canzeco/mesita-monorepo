import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PlaceNav } from "@/components/business/PlaceNav";
import { PlaceChromeProvider } from "@/components/business/PlaceChrome";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPlaceOverview } from "@/lib/api/place";
import { ACTIVE_PLACE_COOKIE, resolveActivePlaceId } from "@/lib/active-place";

// The per-place console. Full-width desktop layout: the MobileFrame card
// (a 384px phone with a fake 9:41 status bar) and the bottom PlaceDock are
// gone — this is a web console, not a phone mock.
//
// No onboarding gate either. The console used to bounce anyone without a
// profile full_name to /onboard; you pick a place from /places and manage
// it, and nobody is asked their name to get there.

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
  if (!user) redirect("/signin");

  let overview: Awaited<ReturnType<typeof getPlaceOverview>> | null = null;
  try {
    overview = await getPlaceOverview(supabase, null);
  } catch (err) {
    console.error("[console] business-web-get-overview:", err);
  }

  const cookieStore = await cookies();
  const cookiePlaceId = cookieStore.get(ACTIVE_PLACE_COOKIE)?.value ?? null;
  const places = overview?.places ?? [];
  const activePlaceId = resolveActivePlaceId({
    cookieId: cookiePlaceId,
    projectIds: places.map((v) => v.id),
  });

  return (
    <PlaceChromeProvider value={{ activePlaceId, places }}>
      <div className="bg-background flex min-h-screen flex-col">
        <PlaceNav />
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
          {children}
        </div>
      </div>
    </PlaceChromeProvider>
  );
}
