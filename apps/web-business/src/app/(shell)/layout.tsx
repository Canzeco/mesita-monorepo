// The console shell. Four screens over one organization at a time.
//
// The layout resolves the caller's organizations once and hands the list to
// the rail, so the switcher is populated on every screen without each page
// re-fetching it. WHICH one is active is resolved from ?org= by the rail
// (client-side) and by each page (server-side) — layouts cannot read
// searchParams, so this file deliberately does not decide it. The header's
// breadcrumb needs a NAME on the first frame though, so it takes the same
// fallback every page uses: the first organization.
//
// The nav is a lateral rail as of MESITA-1710; AppShell owns the frame and is
// the only scroller. See its docblock for why `TOPNAV_OCCUPIED_PX` no longer
// exists.
import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/console/AppShell";
import { OpenPlaceProvider } from "@/components/console/OpenPlace";
import { SHELL_GUTTER } from "@/lib/ui-classes";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/sidebar-prefs";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { apiListOrganizations } from "@/lib/api/organizations";

export const metadata: Metadata = {
  title: "Console",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();

  // The user check and the org list are independent: both need the client,
  // neither needs the other's answer. Awaiting them on consecutive lines cost
  // a full round trip on EVERY navigation in the console, because this layout
  // is force-dynamic and re-renders each time (MESITA-1729).
  //
  // The signed-out path now pays for an org list it will not use. That is the
  // right trade: middleware already turns most signed-out traffic away before
  // it reaches here, and the redirect below still fires first.
  //
  // A failure in the org list must not blank the console: the rail degrades to
  // no switcher and each page reports its own error.
  const [user, organizations] = await Promise.all([
    getServerUser(),
    apiListOrganizations(supabase).catch((err) => {
      console.error("[console] business-web-list-organizations:", err);
      return [] as Awaited<ReturnType<typeof apiListOrganizations>>;
    }),
  ]);
  if (!user) redirect("/signin");

  const collapsed =
    (await cookies()).get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";

  return (
    // Suspense because the rail and the header both read searchParams.
    // The fallback is a bare frame rather than a spinner: the shell's job is
    // to be there instantly, and a flashing skeleton rail is worse than a
    // quiet one.
    <Suspense fallback={<div className="bg-background fixed inset-0" />}>
      {/* The provider wraps the SHELL, not sits inside it: the mobile
          wordmark lives in AppShell's own topbar and needs the guard too, and
          a hook cannot see a provider its own component renders. */}
      <OpenPlaceProvider>
        <AppShell
          organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
          defaultCollapsed={collapsed}
        >
        {/* FLUID: no max-width (MESITA-1558). Two things depend on that and
            neither is cosmetic — a full-bleed child cancels SHELL_GUTTER with
            SHELL_BLEED and only reaches the column edge if nothing caps it, and
            the place sections only earn a third column when the width exists to
            hold one. Readability is protected per-element (FORM_COLUMN_CLASS),
            not by squeezing the whole console. */}
          <div className={`flex w-full flex-col gap-4 py-4 sm:py-8 ${SHELL_GUTTER}`}>
            {children}
          </div>
        </AppShell>
      </OpenPlaceProvider>
    </Suspense>
  );
}
