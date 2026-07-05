import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { StatusBar } from "@/components/consumer/StatusBar";
import { TopBar } from "@/components/consumer/TopBar";
import { BottomNav } from "@/components/consumer/BottomNav";
import { ShellChildrenSlot } from "@/components/consumer/ShellChildrenSlot";
import { Toaster } from "@/components/consumer/Toaster";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiFetchConsumerProfile,
  type ConsumerClass,
} from "@/lib/api/profile";
import { ClassProvider } from "@/lib/class-context";

// Every route under /(shell) calls supabase.auth.getUser() via this layout
// and therefore can never be prerendered to static HTML. Mark the segment
// dynamic so Next.js skips the page-data collection pass — otherwise a
// pure-client page like /discover/add (which renders fine at runtime) trips
// the layout's createServerSupabase() at build time and the whole build
// exits with a "Missing NEXT_PUBLIC_SUPABASE_URL" error.
export const dynamic = "force-dynamic";

// Mandatory onboarding gate for every page inside /(shell).
//
// No exceptions: a consumer with a half-filled profile (no name / country /
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
  const pathname = (await headers()).get("x-pathname") ?? "";
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(pathname ? `/?next=${encodeURIComponent(pathname)}` : "/");
  }

  // consumer-get-profile lazily creates the row, so a brand-new account still
  // reads back successfully (just with null fields). If the EF throws, we
  // surface the error route — better than rendering a half-broken shell.
  // Only the class is threaded into the shell now — the Profile TopBar
  // titles itself "me" + current class rather than the display name.
  let consumerClass: ConsumerClass | null = null;
  try {
    const { consumer: profile, consumerClass: c } =
      await apiFetchConsumerProfile(supabase);
    const onboarded =
      !!profile.full_name &&
      !!profile.country &&
      !!profile.birthday &&
      !!profile.sex;
    if (!onboarded) redirect("/onboard");
    consumerClass = c;
  } catch {
    redirect("/onboard");
  }

  // Two-box layout strategy (per user spec):
  //   - Top: StatusBar + TopBar (combined chrome band, shrink-0).
  //   - Bottom: BottomNav (shrink-0).
  //   - Middle: the body — flex-1, overflows internally via the page's
  //     own scroll container; never affects the chrome bands.
  //
  // The bottom nav is shown on every shell route. (Invite/Share used to hide
  // it, which made the chrome appear to "break" when entering that surface —
  // it's a first-class destination now, so it keeps the tabs like the rest.)

  // The modal slot is rendered last in this relative shell wrapper.
  // Section-scoped modal routes mount absolute overlays that intentionally
  // cover BOTH top bar and bottom nav while preserving the underlying shell.
  return (
    <MobileFrame>
      <StatusBar />
      <ClassProvider consumerClass={consumerClass}>
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <ShellChildrenSlot>{children}</ShellChildrenSlot>
          </div>
          <BottomNav userId={user.id} />
          {/* Single modal host layer above shell chrome. Keeping this as the
              only stacking context avoids "menu peeking through" races while
              intercepted routes resolve/loading UI mounts. */}
          <div className="pointer-events-none absolute inset-0 z-[120]">
            {modal}
          </div>
        </div>
      </ClassProvider>
      <Toaster />
    </MobileFrame>
  );
}
