import { Suspense } from "react";

import { Z_ROUTE_MODAL } from "@/lib/z-index";
import { cn, errMsg } from "@/lib/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { BottomNav } from "@/components/consumer/BottomNav";
import { PendingScreen } from "@/components/consumer/PendingScreen";
import { ShellLoadingFor } from "./shell-loading";
import { ConsumerLocalDataGuard } from "@/components/consumer/ConsumerLocalDataGuard";
import { PlaceGoneNotice } from "@/components/consumer/PlaceGoneNotice";
import { Toaster } from "@/components/consumer/Toaster";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { ConsumerIdentityProvider } from "@/lib/identity-context";
import { consumerCanBrowse } from "@/lib/consumer-onboarding";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { withNext } from "@/lib/auth-redirect";

// Every route under /(shell) calls supabase.auth.getUser() via this layout
// and therefore can never be prerendered to static HTML. Mark the segment
// dynamic so Next.js skips the page-data collection pass — otherwise a
// pure-client page (which renders fine at runtime) trips
// the layout's createServerSupabase() at build time and the whole build
// exits with a "Missing NEXT_PUBLIC_SUPABASE_URL" error.
export const dynamic = "force-dynamic";

// The bar's four destinations, whose placeholders PendingScreen paints the
// moment a tab is touched (MESITA-2846). A client module's exports are only
// references here, so the list is BottomNav's hrefs, restated.
const BAR_HREFS = [
  CONSUMER_ROUTES.home,
  CONSUMER_ROUTES.search,
  CONSUMER_ROUTES.pay,
  CONSUMER_ROUTES.me,
] as const;

// Mandatory onboarding gate for every page inside /(shell).
//
// No exceptions: a consumer with a half-filled profile (no name /
// birthday / sex) gets bounced to /onboard. Onboard is the only
// surface that knows how to collect the missing fields, so every other
// route assumes the row is complete and renders accordingly. This kills
// the "Complete your profile" half-state — it should never be reachable.
//
// Phone is omitted from the completeness check on purpose: sign-in is
// phone OTP, so every authed consumer already has one on auth.user.
export default async function ConsumerShellLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const requestHeaders = await headers();
  // The proxy stamps both halves — a Server Component can't read its own
  // URL. `here` is what the guest actually asked for, params included, and
  // it rides every redirect below so nothing is lost at the wall.
  const pathname = requestHeaders.get("x-pathname") ?? "";
  const here = pathname
    ? `${pathname}${requestHeaders.get("x-search") ?? ""}`
    : "";
  const supabase = await createServerSupabase();
  // THE TWO OREGON READS RUN TOGETHER (MESITA-2850). A hard load waits on
  // this layout, and it used to ask for the user, then for the profile: two
  // round trips back to back. The profile read leaves now, beside getUser;
  // its result is only used once the wall below has passed, and a visitor it
  // was not meant for gets a failed read that nothing ever looks at.
  const profileRead = apiFetchConsumerProfile(supabase).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  const user = (await supabase.auth.getUser()).data.user;
  // ONE WALL (MESITA-2137): no anonymous sessions, so a visitor without an
  // account goes to the phone sign-in. A leftover anonymous session from the
  // MESITA-2066 era counts as none.
  if (!user || user.is_anonymous) {
    redirect(withNext("/", here));
  }

  // consumer-get-profile lazily creates the row, so a brand-new account still
  // reads back successfully (just with null fields). The row is read ONCE
  // here and its identity (Instagram) is threaded into the shell
  // through ConsumerIdentityProvider; pages never re-fetch it.
  //
  // "The EF threw" is NOT the same as "the profile is incomplete": a cold
  // start, a 500 or a dropped connection would otherwise eject a fully
  // onboarded consumer to /onboard (where the form's own fetch fails the
  // same way, so they'd be asked to re-enter data they already gave us —
  // and on the next success they'd bounce back here). On a throw we render
  // the shell degraded and let each page surface its own error; the session
  // is intact and nothing here is security-relevant.
  //
  // redirect() throws NEXT_REDIRECT, so it MUST stay outside the read's
  // failure branch — otherwise a redirect would be reported as a failure.
  let instagramHandle: string | null = null;
  let instagramFollowers: number | null = null;
  let needsOnboarding = false;
  // "The EF threw" is not "the guest has no Instagram" (design review
  // 2026-08-22). This layout deliberately degrades rather than ejecting, so
  // a failed read and an account with nothing connected would otherwise be
  // the same state — and a surface that states the fact would assert the
  // guess. Only this catch knows the difference, so it says so.
  let profileUnavailable = false;
  const read = await profileRead;
  if (read.ok) {
    const { consumer: profile } = read.value;
    // The SIGNUP gate only — first name + birthday (MESITA-1806). A missing
    // last name no longer ejects anyone to /onboard; the reservation sheet
    // asks for it at the one moment it is load-bearing.
    needsOnboarding = !consumerCanBrowse(profile);
    instagramHandle = profile.instagram_handle?.trim() || null;
    instagramFollowers = profile.instagram_followers_count ?? null;
  } else {
    console.error(
      "[consumer/shell] consumer-get-profile:",
      errMsg(read.error, "profile fetch failed"),
    );
    profileUnavailable = true;
  }
  // Carry the destination into onboarding so finishing the form lands the
  // guest on what they originally opened, not a generic home tab.
  // Every registered account finishes signup, whichever surface it opened —
  // only an anonymous browse session is exempt (Bugbot, PR #1995).
  if (needsOnboarding && !user.is_anonymous) {
    redirect(withNext(CONSUMER_ROUTES.onboard, here));
  }

  // Two-box layout strategy (per user spec):
  //   - Bottom: BottomNav (shrink-0).
  //   - Middle: the body — flex-1, overflows internally via the page's
  //     own scroll container; never affects the chrome band.
  //   (No top status bar — the app fills the frame from the very top.)
  //
  // The bottom nav is shown on every shell route.

  // The modal slot is rendered last in this relative shell wrapper.
  // Section-scoped modal routes mount absolute overlays that intentionally
  // cover BOTH top bar and bottom nav while preserving the underlying shell.
  //
  // ONE FRAME FOR BOTH SURFACES (Pato, MESITA-2134: "make it kinda like a
  // mobile emulator in web — fuck the sidebar menu"). /web and /mob both
  // draw the phone card and sign in by phone; only the address differs.
  return (
    <MobileFrame>
      {/* Runs before the children subtree hydrates the saved set, so a fresh
          consumer never inherits the previous account's localStorage-backed
          favorites / reservations (survives sign-out + DB reset). */}
      <ConsumerLocalDataGuard consumerId={user.id} />
      {/* Turns the place-detail 404 bounce into a stated reason + prunes the
          dead id. Suspense because it reads useSearchParams. */}
      <Suspense fallback={null}>
        <PlaceGoneNotice />
      </Suspense>
      <ConsumerIdentityProvider
        instagramHandle={instagramHandle}
        instagramFollowers={instagramFollowers}
        profileUnavailable={profileUnavailable}
      >
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Body + modal host only: the @modal slot must not sit above
              BottomNav. An `inset-0` host as a sibling after the tab bar
              covered its hit targets even with pointer-events-none on the
              wrapper (MESITA-2747). Intercepted routes that need the bar
              hidden already do it on the page (place detail). */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
            {/* The tapped tab's placeholder, drawn on finger-down over the
                old screen until the new one commits (MESITA-2846). */}
            <PendingScreen
              frames={Object.fromEntries(
                BAR_HREFS.map((href) => [
                  href,
                  <ShellLoadingFor key={href} bare={href} />,
                ]),
              )}
            />
            <div
              className={cn(
                "pointer-events-none absolute inset-0",
                Z_ROUTE_MODAL,
              )}
            >
              {modal}
            </div>
          </div>
          <BottomNav />
        </div>
      </ConsumerIdentityProvider>
      <Toaster />
    </MobileFrame>
  );
}
