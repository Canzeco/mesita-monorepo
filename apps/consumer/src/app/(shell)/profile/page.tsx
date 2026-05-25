import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiFetchConsumerProfile } from "@/lib/api/tickets";
import { ProfileClient, type RealIdentity } from "./ProfileClient";

// Server shell: loads the real identity (full_name / country / birthday
// from the consumers row, email from auth.users) and hands it to the client
// tabs view. Everything else on the page is mock until the matching
// schema + Edge Functions ship.

export const dynamic = "force-dynamic";

export default async function ConsumerProfilePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/profile");

  // consumer-profile auto-creates the row on first call; we also pull the
  // onboarding extras separately because the lean profile endpoint only
  // returns code + name + phone + balance. Reading the second set lazily
  // through a guarded query keeps the layout cost low when the consumer
  // hasn't onboarded yet.
  let identity: RealIdentity = {
    fullName: null,
    email: user.email ?? null,
    country: null,
    birthday: null,
    sex: null,
  };

  try {
    const profile = await apiFetchConsumerProfile(supabase);
    identity = {
      fullName: profile.full_name,
      email: user.email ?? null,
      country: profile.country,
      birthday: profile.birthday,
      sex: profile.sex,
    };
  } catch (err) {
    // Profile fetch failure shouldn't blow up the page — the user can
    // still see the mock preview, log out, etc.
    console.error("[consumer/profile] consumer-profile:", err);
  }

  return <ProfileClient identity={identity} />;
}
