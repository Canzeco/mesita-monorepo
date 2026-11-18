import { Suspense } from "react";

import { Z_ROUTE_MODAL } from "@/lib/z-index";
import { cn, errMsg } from "@/lib/utils";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { ScreenStage } from "@/components/consumer/nav/ScreenStage";
import { BottomNav } from "@/components/consumer/BottomNav";
import { PendingTicketBanner } from "@/components/consumer/pay/PendingTicketBanner";
import { PendingScreen } from "@/components/consumer/PendingScreen";
import { ShellEntry } from "@/components/consumer/ShellEntry";
import { ShellLoadingFor } from "./shell-loading";
import { ConsumerLocalDataGuard } from "@/components/consumer/ConsumerLocalDataGuard";
import { PlaceGoneNotice } from "@/components/consumer/PlaceGoneNotice";
import { Toaster } from "@/components/consumer/Toaster";
import { PendingSignIntent } from "@/components/consumer/anonymous/PendingSignIntent";
import { SignGateModal } from "@/components/consumer/anonymous/SignGateModal";
import { WelcomeModal } from "@/components/consumer/anonymous/WelcomeModal";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import { ConsumerIdentityProvider } from "@/lib/identity-context";
import { consumerCanBrowse } from "@/lib/consumer-onboarding";
import {
  CONSUMER_ROUTES,
  isOpenToAnonymous,
} from "@/lib/consumer-route-contract";
import { anonymousBrowseOn } from "@/lib/anonymous-flag";
import type { Viewer } from "@/lib/anonymous";
import { withNext } from "@/lib/auth-redirect";
import { clearSessionHref, isTransientAuthError } from "@/lib/stale-session";

// Every route under /(shell) calls supabase.auth.getUser() via this layout
// and therefore can never be prerendered to static HTML. Mark the segment
// dynamic so Next.js skips the page-data collection pass — otherwise a
// pure-client page (which renders fine at runtime) trips
// the layout's createServerSupabase() at build time and the whole build
// exits with a "Missing NEXT_PUBLIC_SUPABASE_URL" error.
export const dynamic = "force-dynamic";

// The bar's four destinations, whose placeholders PendingScreen paints the
// moment a tab is touched (MESITA-2846). A client module's exports are only
// references here, so the list is BottomNav's hrefs, restated. Share, the
// fourth slot, is a button with no screen (MESITA-3855).
const BAR_HREFS = [
  CONSUMER_ROUTES.home,
  CONSUMER_ROUTES.search,
  CONSUMER_ROUTES.pay,
  CONSUMER_ROUTES.me,
] as const;

// Mandatory onboarding gate for every page inside /(shell).
//
// No exceptions: a consumer with a half-filled profile (no name /
// birth year / sex) gets bounced to /onboard. Onboard is the only
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
  // ANONYMOUS MODE (MESITA-4246): Home, Search, a place and Social open
  // without an account (the route contract's one list). Everything else is
  // a member's and sends the visitor to Sign with where they were.
  const openHere = anonymousBrowseOn() && isOpenToAnonymous(pathname);
  // THE TWO OREGON READS RUN TOGETHER (MESITA-2850). A hard load waits on
  // this layout, and it used to ask for the user, then for the profile: two
  // round trips back to back. The profile read leaves now, beside getUser,
  // but only when the request carries a Supabase session cookie: an
  // anonymous visitor costs no profile call (MESITA-4246).
  const hasSessionCookie = (await cookies())
    .getAll()
    .some((c) => c.name.startsWith("sb-"));
  const profileRead = hasSessionCookie
    ? apiFetchConsumerProfile(supabase).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      )
    : null;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const authUser = userData.user;
  // ONE WALL (MESITA-2137, MESITA-4246): no Supabase anonymous sessions; a
  // leftover one from the MESITA-2066 era counts as no account. Without an
  // account an open screen renders for an anonymous visitor; any other
  // screen goes to Sign. MESITA-3590: no user goes through
  // /auth/clear-session, which clears a cookie naming a deleted user. An Auth
  // outage throws to the error boundary instead of signing anyone out.
  const user = authUser && !authUser.is_anonymous ? authUser : null;
  if (!user) {
    if (!authUser && isTransientAuthError(userError)) throw userError;
    if (!openHere) {
      redirect(
        authUser
          ? withNext(CONSUMER_ROUTES.sign, here)
          : clearSessionHref(here),
      );
    }
  }

  // consumer-get-profile lazily creates the row, so a brand-new account still
  // reads back successfully (just with null fields). The row is read ONCE
  // here and its identity (Instagram) is threaded into the shell
  // through ConsumerIdentityProvider; pages never re-fetch it.
  //
  // "The EF threw" is NOT the same as "the profile is incomplete": a cold
  // start, a 500 or a dropped connection would otherwise eject a fully
  // onboarded consumer to onboarding. On a throw we render the shell
  // degraded (viewer `unknown`) and let each page surface its own error.
  //
  // redirect() throws NEXT_REDIRECT, so it MUST stay outside the read's
  // failure branch — otherwise a redirect would be reported as a failure.
  let instagramHandle: string | null = null;
  let instagramFollowers: number | null = null;
  let needsOnboarding = false;
  // "The EF threw" is not "the guest has no Instagram" (design review
  // 2026-08-22). Only this catch knows the difference, so it says so.
  let profileUnavailable = false;
  let profile: ConsumerProfile | null = null;
  if (user) {
    const read = profileRead
      ? await profileRead
      : await apiFetchConsumerProfile(supabase).then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error }),
        );
    if (read.ok) {
      profile = read.value.consumer;
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
  }
  // A signed-in account that has not finished onboarding is anonymous on an
  // open screen and finishes on Sign for everything else (MESITA-4246).
  if (user && needsOnboarding && !openHere) {
    redirect(withNext(CONSUMER_ROUTES.sign, here));
  }
  const viewer: Viewer =
    !user || needsOnboarding
      ? "anonymous"
      : profileUnavailable
        ? "unknown"
        : "member";

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
      {user ? <ConsumerLocalDataGuard consumerId={user.id} /> : null}
      {/* Where Back lands (MESITA-3614): the entry the app opened on. */}
      <ShellEntry />
      {/* Turns the place-detail 404 bounce into a stated reason + prunes the
          dead id. Suspense because it reads useSearchParams. */}
      <Suspense fallback={null}>
        <PlaceGoneNotice />
      </Suspense>
      <ConsumerIdentityProvider
        instagramHandle={instagramHandle}
        instagramFollowers={instagramFollowers}
        profileUnavailable={profileUnavailable}
        profile={profile}
        viewer={viewer}
      >
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* A ticket left open, on every screen with the bar (MESITA-3906),
              at the very top of the app above every header (MESITA-4069,
              Pato: "this message must go on top of the header, at the top
              of the app, like the yellow warning"; above the tab bar under
              MESITA-4051). */}
          <PendingTicketBanner />
          {/* Body + modal host only: the @modal slot must not sit above
              BottomNav. An `inset-0` host as a sibling after the tab bar
              covered its hit targets even with pointer-events-none on the
              wrapper (MESITA-2747). Where the bar shows is the route
              map's `bar` (the place screen hides it, MESITA-3300). */}
          {/* The stage: a drill-in slides the new screen in over the old
              one, Back slides it away (MESITA-3644). */}
          <ScreenStage>
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
          </ScreenStage>
          <BottomNav />
          <PendingSignIntent />
          <WelcomeModal />
          <SignGateModal />
        </div>
      </ConsumerIdentityProvider>
      <Toaster />
    </MobileFrame>
  );
}
