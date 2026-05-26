import { redirect } from "next/navigation";
import { MobileFrame } from "@/components/consumer/MobileFrame";
import { StatusBar } from "@/components/consumer/StatusBar";
import { BottomNav } from "@/components/consumer/BottomNav";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/tickets";

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
// Phone is collected too, but it's optional today (sign-in is email/OAuth
// only) and intentionally left out of the completeness check.
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
  try {
    const profile = await apiFetchConsumerProfile(supabase);
    const onboarded =
      !!profile.full_name &&
      !!profile.country &&
      !!profile.birthday &&
      !!profile.sex;
    if (!onboarded) redirect("/onboard");
  } catch {
    redirect("/onboard");
  }

  return (
    <MobileFrame>
      <StatusBar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {children}
        {modal}
      </div>
      <BottomNav />
    </MobileFrame>
  );
}
