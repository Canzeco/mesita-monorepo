import { Suspense } from "react";

import { Z_ROUTE_MODAL } from "@/lib/z-index";
import { cn } from "@/lib/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { BottomNav } from "@/components/consumer/BottomNav";
import { ConsumerLocalDataGuard } from "@/components/consumer/ConsumerLocalDataGuard";
import { PlaceGoneNotice } from "@/components/consumer/PlaceGoneNotice";
import { ShellChildrenSlot } from "@/components/consumer/ShellChildrenSlot";
import { Toaster } from "@/components/consumer/Toaster";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile, type ConsumerClass } from "@/lib/api/profile";
import { ClassProvider } from "@/lib/class-context";
import { DiscountQuotesProvider } from "@/lib/discount-quotes";
import { isConsumerOnboarded } from "@/lib/consumer-onboarding";
import { withNext } from "@/lib/auth-redirect";

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
  const here = pathname
    ? `${pathname}${requestHeaders.get("x-search") ?? ""}`
    : "";
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(withNext("/", here));
  }

  // consumer-get-profile lazily creates the row, so a brand-new account still
  // reads back successfully (just with null fields). Only the class is
  // threaded into the shell now — the Profile TopBar titles itself "me" +
  // current class rather than the display name.
  //
  // "The EF threw" is NOT the same as "the profile is incomplete": a cold
  // start, a 500 or a dropped connection would otherwise eject a fully
  // onboarded consumer to /onboard (where the form's own fetch fails the
  // same way, so they'd be asked to re-enter data they already gave us —
  // and on the next success they'd bounce back here). On a throw we render
  // the shell degraded (no class styling) and let each page surface its own
  // error; the session is intact and nothing here is security-relevant.
  // Mobile made the same call in providers/auth.tsx.
  //
  // redirect() throws NEXT_REDIRECT, so it MUST stay outside the try —
  // otherwise the catch swallows it and reports a redirect as a failure.
  let consumerClass: ConsumerClass | null = null;
  let instagramHandle: string | null = null;
  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  let needsOnboarding = false;
  // "The EF threw" is not "the guest is Bronze" (design review 2026-08-22).
  // This layout deliberately degrades rather than ejecting, and the comment
  // above promises each page will surface its own error. The Class sheet
  // could not: `normalize(null)` hands it the FLOOR, so a failed read and a
  // real Bronze account were the same state — and it asserted that state to
  // screen readers with aria-current. Only this catch knows the difference,
  // so it says so.
  let classUnavailable = false;
  try {
    const { consumer: profile, consumerClass: c } =
      await apiFetchConsumerProfile(supabase);
    needsOnboarding = !isConsumerOnboarded(profile);
    consumerClass = c;
    instagramHandle = profile.instagram_handle?.trim() || null;
    // Identity for the whole shell (MESITA-1029 S1): THE TICKET's pass bar
    // reads this from context instead of re-fetching the profile per open.
    const first = profile.first_name?.trim() ?? "";
    const last = profile.last_name?.trim() ?? "";
    displayName =
      [first, last].filter(Boolean).join(" ") ||
      profile.full_name?.trim() ||
      null;
    avatarUrl = profile.avatar_url ?? null;
  } catch (err) {
    console.error("[consumer/shell] consumer-get-profile:", err);
    classUnavailable = true;
  }
  // Carry the destination into onboarding so finishing the form lands the
  // guest on what they originally opened, not a generic home tab.
  if (needsOnboarding) redirect(withNext("/onboard", here));

  // Two-box layout strategy (per user spec):
  //   - Bottom: BottomNav (shrink-0).
  //   - Middle: the body — flex-1, overflows internally via the page's
  //     own scroll container; never affects the chrome band.
  //   (No top status bar — the app fills the frame from the very top.)
  //
  // The bottom nav is shown on every shell route. (Invite/Share used to hide
  // it, which made the chrome appear to "break" when entering that surface —
  // it's a first-class destination now, so it keeps the tabs like the rest.)

  // The modal slot is rendered last in this relative shell wrapper.
  // Section-scoped modal routes mount absolute overlays that intentionally
  // cover BOTH top bar and bottom nav while preserving the underlying shell.
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
      <ClassProvider
        consumerClass={consumerClass}
        instagramHandle={instagramHandle}
        userId={user.id}
        displayName={displayName}
        avatarUrl={avatarUrl}
        classUnavailable={classUnavailable}
      >
        {/* One engine-quote cache for the whole shell (MESITA-1019). Mounted
            here, not per surface, so the promo chip resolves the same number
            wherever it renders and a place quoted on the swipe deck is
            already answered when the guest opens it.

            `key` is the owner stamp: a quote is one guest's OWN rate, so a
            different consumer in the same tab gets a fresh provider and an
            empty cache instead of inheriting the previous guest's numbers. */}
        <DiscountQuotesProvider key={user.id}>
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <ShellChildrenSlot>{children}</ShellChildrenSlot>
            </div>
            <BottomNav userId={user.id} />
            {/* Single modal host layer above shell chrome. Keeping this as the
              only stacking context avoids "menu peeking through" races while
              intercepted routes resolve/loading UI mounts. */}
            <div
              className={cn(
                "pointer-events-none absolute inset-0",
                Z_ROUTE_MODAL,
              )}
            >
              {modal}
            </div>
          </div>
        </DiscountQuotesProvider>
      </ClassProvider>
      <Toaster />
    </MobileFrame>
  );
}
