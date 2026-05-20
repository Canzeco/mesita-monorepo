import { redirect } from "next/navigation";
import { Sidebar } from "@/components/manager/Sidebar";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { apiGetManagerProfile, type ManagerProfile } from "@/lib/api/manager";

// Sidebar-wrapped manager shell. Lives under a route group so the URL
// stays /manager/<page> while sibling routes (sign-in, sign-up, onboard,
// create_unit) opt out of the shell and render full-screen.
//
// Mandatory onboarding gate: a manager who hasn't filled their name gets
// bounced to /manager/onboard. No exceptions — every shell page assumes
// the profile is complete and the half-state isn't reachable.
export const dynamic = "force-dynamic";

export default async function ManagerShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/manager/sign-in");

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
  if (!manager?.full_name) redirect("/manager/onboard");

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
