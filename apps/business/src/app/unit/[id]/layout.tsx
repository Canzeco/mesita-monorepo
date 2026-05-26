import { redirect } from "next/navigation";
import { Sidebar } from "@/components/business/Sidebar";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import {
  apiGetBusinessProfile,
  type BusinessProfile,
} from "@/lib/api/business";

// Sidebar-wrapped business shell. Auth flow is now one path:
//   - Require a Supabase session (middleware bounces signed-out users
//     to /).
//   - Load the unit overview. The EF reads the JWT and decides whether
//     the caller is a super-admin (email in public.super_admins) — when
//     true, the EF skips the venue_members check and returns the
//     requested venue with the response field `isSuperAdmin: true`.
//   - Onboarded-profile check is skipped for super-admin operators
//     because they don't need a businesses row to operate on a venue
//     they don't own.

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

  // Overview first — its `isSuperAdmin` field tells us whether to enforce
  // the onboarded-profile redirect. Profile load runs in parallel either
  // way; we discard it for super-admins.
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
    <div className="bg-background flex h-screen w-screen overflow-hidden">
      <Sidebar
        venues={overview?.venues ?? []}
        isSuperAdmin={isSuperAdmin}
        user={{
          email: user.email ?? null,
          fullName: isSuperAdmin
            ? "Super admin"
            : (business?.full_name ?? null),
        }}
      />
      {/* SuperAdminBanner is mounted globally by the root layout, so
          it's already visible above this layout. The shell only wraps
          the sidebar + content. */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
