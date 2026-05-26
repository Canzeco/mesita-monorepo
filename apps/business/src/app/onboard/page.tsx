import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiGetBusinessProfile,
  type BusinessProfile,
} from "@/lib/api/business";
import { AppHeader } from "@/components/auth/AppHeader";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";
import { BusinessOnboardForm } from "./BusinessOnboardForm";

// Business onboarding — captures the business operator's name after signup.
// Distinct from venue creation; this is about the *person*, the venue
// gets its own wizard step at /add.
//
// Server-gated:
//   - signed out         → / (with next=/onboard)
//   - already onboarded  → /central (skip past us)
//   - signed in, no name → render the form
//
// Renders AppHeader on top so the operator has a visible sign-out
// path mid-flow — even though they don't have a profile or venues yet,
// they may have signed in with the wrong Google account and want to
// switch.
export const dynamic = "force-dynamic";

export default async function BusinessOnboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/onboard");

  // redirect() throws NEXT_REDIRECT, so it MUST live outside the
  // try/catch — otherwise the catch swallows the redirect and the
  // already-onboarded user sees the form again.
  let profile: BusinessProfile | null = null;
  try {
    profile = await apiGetBusinessProfile(supabase);
  } catch (err) {
    console.error("[business/onboard] business-get-profile:", err);
  }
  if (profile?.full_name) redirect("/central");

  return (
    <AuthShell header={<AppHeader email={user.email ?? null} venues={[]} />}>
      <AuthCard
        title="Welcome to Mesita"
        subtitle="Tell us who you are. You can add your venue right after."
      >
        <BusinessOnboardForm />
      </AuthCard>
    </AuthShell>
  );
}
