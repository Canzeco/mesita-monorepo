import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { StatusBar } from "@/components/consumer/StatusBar";
import { TopBar } from "@/components/consumer/TopBar";
import { BottomNav } from "@/components/consumer/BottomNav";
import { ShellChildrenSlot } from "@/components/consumer/ShellChildrenSlot";
import { Toaster } from "@/components/consumer/Toaster";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/profile";

// Every route under /(shell) calls supabase.auth.getUser() via this layout
// and therefore can never be prerendered to static HTML. Mark the segment
// dynamic so Next.js skips the page-data collection pass — otherwise a
// pure-client page like /discover/ai (which renders fine at runtime) trips
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
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // consumer-get-profile lazily creates the row, so a brand-new account still
  // reads back successfully (just with null fields). If the EF throws, we
  // surface the error route — better than rendering a half-broken shell.
  // Also captures the consumer's display name so the /profile TopBar can
  // render it instead of the literal word "Profile".
  let userName: string | null = null;
  try {
    const profile = await apiFetchConsumerProfile(supabase);
    const onboarded =
      !!profile.full_name &&
      !!profile.country &&
      !!profile.birthday &&
      !!profile.sex;
    if (!onboarded) redirect("/onboard");
    userName =
      profile.first_name && profile.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : (profile.first_name ?? profile.last_name ?? profile.full_name);
  } catch {
    redirect("/onboard");
  }

  // Two-box layout strategy (per user spec):
  //   - Top: StatusBar + TopBar (combined chrome band, shrink-0).
  //   - Bottom: BottomNav (shrink-0).
  //   - Middle: the body — flex-1, overflows internally via the page's
  //     own scroll container; never affects the chrome bands.
  //
  // The modal slot lives INSIDE the \`shell-stage\` wrapper that contains
  // TopBar + body + BottomNav. When a modal (e.g. the intercepted
  // /venues/[id] route) is active, its \`absolute inset-0\` covers all
  // three at once — the only thing still visible above it is the
  // StatusBar (deliberate: the iOS-style 9:41/100% strip is decoration,
  // not chrome the modal needs to replace).
  return (
    <MobileFrame>
      <StatusBar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <TopBar userName={userName} />
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <ShellChildrenSlot>{children}</ShellChildrenSlot>
        </div>
        <BottomNav />
        {modal}
      </div>
      <Toaster />
    </MobileFrame>
  );
}
