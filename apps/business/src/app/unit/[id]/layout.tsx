import { redirect } from "next/navigation";
import { Sidebar } from "@/components/manager/Sidebar";
import { SuperAdminBanner } from "@/components/manager/SuperAdminBanner";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { apiGetManagerProfile, type ManagerProfile } from "@/lib/api/manager";

// Sidebar-wrapped manager shell. Auth flow is now one path:
//   - Require a Supabase session (middleware bounces signed-out users
//     to /sign-in).
//   - Load the unit overview. The EF reads the JWT and decides whether
//     the caller is a super-admin (email in public.super_admins) — when
//     true, the EF skips the venue_members check and returns the
//     requested venue with the response field `isSuperAdmin: true`.
//   - Onboarded-profile check is skipped for super-admin operators
//     because they don't need a managers row to operate on a venue
//     they don't own.

export const dynamic = "force-dynamic";

export default async function ManagerShellLayout({
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

  // Overview first — its `isSuperAdmin` field tells us whether to enforce
  // the onboarded-profile redirect. Profile load runs in parallel either
  // way; we discard it for super-admins.
  const [overviewResult, profileResult] = await Promise.allSettled([
    getUnitOverview(supabase, id, 0),
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
  } else if (!overview?.isSuperAdmin) {
    console.error("[manager/(shell)] manager-profile:", profileResult.reason);
  }

  const isSuperAdmin = overview?.isSuperAdmin === true;
  if (!isSuperAdmin && !manager?.full_name) redirect("/onboard");

  return (
    <div className="bg-background flex h-screen w-screen overflow-hidden">
      <Sidebar
        venues={overview?.venues ?? []}
        isSuperAdmin={isSuperAdmin}
        user={{
          email: user.email ?? null,
          fullName: isSuperAdmin ? "Super admin" : (manager?.full_name ?? null),
        }}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {isSuperAdmin && <SuperAdminBanner />}
        {children}
      </main>
    </div>
  );
}
