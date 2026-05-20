import { redirect } from "next/navigation";
import { Sidebar } from "@/components/manager/Sidebar";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { apiGetManagerProfile, type ManagerProfile } from "@/lib/api/manager";
import { getSuperAdminKey } from "@/lib/super-admin-server";

// Sidebar-wrapped manager shell. Two auth paths:
//
//   - Normal users: Supabase session + onboarded profile required.
//   - Super-admin operators: `?superkey=` query param. Middleware copies
//     that value to a request header so this layout can recognise the mode
//     without reaching for searchParams (layouts don't receive them in
//     Next.js). The Sidebar reads the key from window.location.search on
//     the client so internal navigation preserves it.

export const dynamic = "force-dynamic";

export default async function ManagerShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const superKey = await getSuperAdminKey();
  if (superKey) {
    let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
    try {
      overview = await getUnitOverview(null, id, 0, superKey);
    } catch (err) {
      console.error("[manager/(shell)] super-admin overview:", err);
    }
    return (
      <div className="bg-background flex h-screen w-screen overflow-hidden">
        <Sidebar
          venues={overview?.venues ?? []}
          user={{ email: null, fullName: "Super admin" }}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Sidebar needs the venue list AND the manager's own profile so it can
  // greet them by name. Both go through Edge Functions in parallel; the
  // profile read also gates onboarding.
  const [overviewResult, profileResult] = await Promise.allSettled([
    getUnitOverview(supabase, null, 0),
    apiGetManagerProfile(supabase),
  ]);
  let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
  let manager: ManagerProfile | null = null;
  if (overviewResult.status === "fulfilled") {
    overview = overviewResult.value;
  } else {
    console.error(
      "[manager/(shell)] manager-get-overview:",
      overviewResult.reason,
    );
  }
  if (profileResult.status === "fulfilled") {
    manager = profileResult.value;
  } else {
    console.error("[manager/(shell)] manager-profile:", profileResult.reason);
  }
  if (!manager?.full_name) redirect("/onboard");

  return (
    <div className="bg-background flex h-screen w-screen overflow-hidden">
      <Sidebar
        venues={overview?.venues ?? []}
        user={{
          email: user.email ?? null,
          fullName: manager.full_name,
        }}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
