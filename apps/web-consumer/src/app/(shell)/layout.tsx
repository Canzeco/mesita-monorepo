import { Suspense } from "react";

import { Z_ROUTE_MODAL } from "@/lib/z-index";
import { cn, errMsg } from "@/lib/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { WebFrame } from "@/components/consumer/WebFrame";
import { DownloadAppScreen } from "@/components/consumer/DownloadAppScreen";
import { BottomNav } from "@/components/consumer/BottomNav";
import { ConsumerLocalDataGuard } from "@/components/consumer/ConsumerLocalDataGuard";
import { PlaceGoneNotice } from "@/components/consumer/PlaceGoneNotice";
import { ShellChildrenSlot } from "@/components/consumer/ShellChildrenSlot";
import { Toaster } from "@/components/consumer/Toaster";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { ConsumerIdentityProvider } from "@/lib/identity-context";
import { consumerCanBrowse } from "@/lib/consumer-onboarding";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { withNext } from "@/lib/auth-redirect";
import { prefixPath } from "@/lib/surface";
import {
  WEB_GET_THE_APP,
  webRequiresRegisteredAccount,
} from "@/lib/web-surface-auth";

// Every route under /(shell) calls supabase.auth.getUser() via this layout
// and therefore can never be prerendered to static HTML. Mark the segment
// dynamic so Next.js skips the page-data collection pass — otherwise a
// pure-client page (which renders fine at runtime) trips
// the layout's createServerSupabase() at build time and the whole build
// exits with a "Missing NEXT_PUBLIC_SUPABASE_URL" error.
export const dynamic = "force-dynamic";

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
  // Middleware stamps both halves — a Server Component can't read its own
  // URL. `here` is what the guest actually asked for, params included, and
  // it rides every redirect below so nothing is lost at the wall.
  const pathname = requestHeaders.get("x-pathname") ?? "";
  const barePathname = requestHeaders.get("x-bare-pathname") ?? pathname;
  const surface = requestHeaders.get("x-surface") === "mob" ? "mob" : "web";
  const here = pathname
    ? `${pathname}${requestHeaders.get("x-search") ?? ""}`
    : "";
  const supabase = await createServerSupabase();
  const user = (await supabase.auth.getUser()).data.user;
  // /web's anonymous session is minted in middleware, the only place its
  // cookies can be saved. No session here means that failed (sign-ins off, or
  // rate-limited). Sending the guest to /web would bounce straight back to
  // Home and loop forever, so the shell says so instead (Bugbot, PR #1995).
  //
  // It keeps the phone menu below md like every other /web screen
  // (MESITA-2130): a screen with no menu at phone width is a dead end.
  if (!user && surface === "web") {
    return (
      <WebFrame>
        <DownloadAppScreen />
        <BottomNav className="md:hidden" />
      </WebFrame>
    );
  }
  // An anonymous /web session is not an account: /mob still asks for the
  // phone.
  if (!user || (surface === "mob" && user.is_anonymous)) {
    redirect(withNext(surface === "mob" ? prefixPath("mob", "/") : "/", here));
  }
  if (
    surface === "web" &&
    user.is_anonymous &&
    webRequiresRegisteredAccount(barePathname)
  ) {
    redirect(withNext(prefixPath("web", WEB_GET_THE_APP), here));
  }

  // consumer-get-profile lazily creates the row, so a brand-new account still
  // reads back successfully (just with null fields). The row is read ONCE
  // here and its identity (name, photo, Instagram) is threaded into the shell
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
  // redirect() throws NEXT_REDIRECT, so it MUST stay outside the try —
  // otherwise the catch swallows it and reports a redirect as a failure.
  let instagramHandle: string | null = null;
  let instagramFollowers: number | null = null;
  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  let needsOnboarding = false;
  // "The EF threw" is not "the guest has no Instagram" (design review
  // 2026-08-22). This layout deliberately degrades rather than ejecting, so
  // a failed read and an account with nothing connected would otherwise be
  // the same state — and a surface that states the fact would assert the
  // guess. Only this catch knows the difference, so it says so.
  let profileUnavailable = false;
  try {
    const { consumer: profile } = await apiFetchConsumerProfile(supabase);
    // The SIGNUP gate only — first name + birthday (MESITA-1806). A missing
    // last name no longer ejects anyone to /onboard; the reservation sheet
    // asks for it at the one moment it is load-bearing.
    needsOnboarding = !consumerCanBrowse(profile);
    instagramHandle = profile.instagram_handle?.trim() || null;
    instagramFollowers = profile.instagram_followers_count ?? null;
    const first = profile.first_name?.trim() ?? "";
    const last = profile.last_name?.trim() ?? "";
    displayName =
      [first, last].filter(Boolean).join(" ") ||
      profile.full_name?.trim() ||
      null;
    avatarUrl = profile.avatar_url ?? null;
  } catch (err) {
    console.error(
      "[consumer/shell] consumer-get-profile:",
      errMsg(err, "profile fetch failed"),
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
  const Frame = surface === "mob" ? MobileFrame : WebFrame;

  return (
    <Frame>
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
        userId={user.id}
        displayName={displayName}
        avatarUrl={avatarUrl}
        instagramHandle={instagramHandle}
        instagramFollowers={instagramFollowers}
        profileUnavailable={profileUnavailable}
      >
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <ShellChildrenSlot>{children}</ShellChildrenSlot>
          </div>
          <BottomNav
            userId={user.id}
            className={surface === "web" ? "md:hidden" : undefined}
          />
          {/* Single modal host layer above shell chrome. Keeping this as the
              only stacking context avoids "menu peeking through" races while
              intercepted routes resolve/loading UI mounts. */}
          <div
            className={cn("pointer-events-none absolute inset-0", Z_ROUTE_MODAL)}
          >
            {modal}
          </div>
        </div>
      </ConsumerIdentityProvider>
      <Toaster />
    </Frame>
  );
}
