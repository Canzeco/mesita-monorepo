// The console shell. One frame over every screen.
//
// The layout resolves the caller's organizations once — each with its places
// and the caller's role — and hands the whole viewer to the chrome. WHICH
// organization and WHICH place are on screen is not decided here: a layout
// cannot read the pathname, and the pathname is what names them now
// (MESITA-1807, lib/rail-scope.ts). What this file adds is what the pathname
// cannot carry on a fresh request: the two rail cookies (last place, last
// organization), read raw and plausibility-checked, so the first frame paints
// the right boxes without a round trip.
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
  RAIL_ORG_COOKIE,
  RAIL_PLACE_COOKIE,
  SIDEBAR_COLLAPSED_COOKIE,
  plausibleId,
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

  // A failure must not blank the console — and must not read as "you have
  // no organizations" either (MESITA-1793's law: a fetch failure never says
  // "create one"). The rail gets the flag and says so; each page reports its
  // own error.
  // `membershipPrice: null` is the same honest absence every other field
  // carries here: no price was read, so nothing prints one, and PartnerCard
  // falls back to the label rather than inventing a number.
  let viewer: ConsoleViewer = {
    organizations: [],
    isSuperAdmin: false,
    membershipPrice: null,
  };
  let viewerError = false;
  try {
    viewer = await apiConsoleViewer(supabase);
  } catch (err) {
    viewerError = true;
    console.error("[console] business-web-list-organizations:", err);
  }

  const jar = await cookies();
  const collapsed = jar.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";
  const rememberedPlaceId = plausibleId(jar.get(RAIL_PLACE_COOKIE)?.value);
  const rememberedOrgId = plausibleId(jar.get(RAIL_ORG_COOKIE)?.value);

  return (
    // Suspense because the header reads searchParams.
    // The fallback is a bare frame rather than a spinner: the shell's job is
    // to be there instantly, and a flashing skeleton rail is worse than a
    // quiet one.
    <Suspense fallback={<div className="bg-background fixed inset-0" />}>
      {/* The provider wraps the SHELL, not sits inside it: the mobile
          wordmark lives in AppShell's own topbar and needs the guard too, and
          a hook cannot see a provider its own component renders. */}
      <OpenPlaceProvider>
        <AppShell
          organizations={viewer.organizations.map((o) => ({
            id: o.id,
            name: o.name,
            myRole: o.myRole,
            places: o.places,
            // The two tier flags ride the rail's list so a place's ladder can
            // read its holder's Partner / Mesita Pay state without a second
            // org-list call (MESITA-1867). Copied as they are: undefined on a
            // stale payload stays undefined, which the ladder reads as
            // unknown, never as off.
            partnered: o.partnered,
            mesitaPayEnabled: o.mesitaPayEnabled,
          }))}
          isSuperAdmin={viewer.isSuperAdmin}
          viewerError={viewerError}
          accountLabel={user.email ?? "Account"}
          rememberedPlaceId={rememberedPlaceId}
          rememberedOrgId={rememberedOrgId}
          defaultCollapsed={collapsed}
        >
          {/* FLUID: no max-width (MESITA-1558). Two things depend on that and
            neither is cosmetic — a full-bleed child cancels SHELL_GUTTER with
            SHELL_BLEED and only reaches the column edge if nothing caps it, and
            the place sections only earn a third column when the width exists to
            hold one. Readability is protected per-element (FORM_COLUMN_CLASS),
            not by squeezing the whole console. */}
          <div
            className={`flex w-full flex-col gap-4 py-4 sm:py-8 ${SHELL_GUTTER}`}
          >
            {children}
          </div>
        </AppShell>
      </OpenPlaceProvider>
    </Suspense>
  );
}
