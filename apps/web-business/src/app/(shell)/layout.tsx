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
import {
  RAIL_OPEN_PLACES_COOKIE,
  RAIL_PORTFOLIO_COOKIE,
  SIDEBAR_COLLAPSED_COOKIE,
  parseOpenPlaceIds,
  parsePortfolioOpen,
} from "@/lib/sidebar-prefs";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { apiConsoleViewer, type ConsoleViewer } from "@/lib/api/organizations";

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

  // The user check FIRST, then the viewer. MESITA-1729 ran the two in
  // parallel because `getServerUser` was a network call; since MESITA-1731 it
  // reads the identity the proxy forwarded, so awaiting it costs nothing on
  // the path every real request takes — and the signed-out hit on `/` (a
  // crawler, an expired session) no longer pays an Edge Function call that
  // can only answer 401 and log an error before the redirect (MESITA-1779).
  const user = await getServerUser();
  if (!user) redirect("/signin");

  // ONE call feeds the switcher AND the rail: every organization with the
  // places it holds, plus whether the caller is a super-admin (MESITA-1779).
  // The rail used to fetch its places a second time after hydration.
  //
  // A failure must not blank the console: the rail degrades to no switcher
  // and no portfolio, and each page reports its own error.
  const viewer: ConsoleViewer = await apiConsoleViewer(supabase).catch(
    (err) => {
      console.error("[console] business-web-list-organizations:", err);
      return { organizations: [], isSuperAdmin: false };
    },
  );
  const organizations = viewer.organizations;

  // All three rail preferences come off the same cookie jar read. Reading
  // them HERE rather than in an effect is what keeps the rail from painting
  // once and then rearranging itself: the width, the open places and the
  // portfolio toggle are all settled before the first frame (MESITA-1734).
  const jar = await cookies();
  const collapsed = jar.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";
  const openPlaceIds = parseOpenPlaceIds(
    jar.get(RAIL_OPEN_PLACES_COOKIE)?.value,
  );
  const portfolioOpen = parsePortfolioOpen(
    jar.get(RAIL_PORTFOLIO_COOKIE)?.value,
  );

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
          organizations={organizations.map((o) => ({
            id: o.id,
            name: o.name,
            myRole: o.myRole,
            places: o.places,
          }))}
          isSuperAdmin={viewer.isSuperAdmin}
          defaultCollapsed={collapsed}
          defaultOpenPlaceIds={openPlaceIds}
          defaultPortfolioOpen={portfolioOpen}
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
