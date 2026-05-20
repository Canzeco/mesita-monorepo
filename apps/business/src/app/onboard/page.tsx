import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiGetManagerProfile } from "@/lib/api/manager";
import { ManagerOnboardForm } from "./ManagerOnboardForm";

// Manager onboarding — captures the manager's own name + phone after
// signup. Distinct from venue creation; this is about the *person*, the
// venue gets its own wizard step at /add.
//
// Server-gated:
//   - signed out         → /manager/sign-in (with next=/onboard)
//   - already onboarded  → /manager/home (don't re-collect a name)
//   - signed in, no name → render the form
export const dynamic = "force-dynamic";

export default async function ManagerOnboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/onboard");

  // manager-get-profile lazily creates the row, so this works for fresh
  // OAuth users too. Treat a thrown response as "render the form" — the
  // submit handler will surface a real error if persistence is broken.
  try {
    const profile = await apiGetManagerProfile(supabase);
    if (profile.full_name) {
      redirect("/");
    }
  } catch (err) {
    console.error("[manager/onboard] manager-get-profile:", err);
  }

  return (
    <div className="bg-hero flex min-h-dvh w-full items-center justify-center px-4 py-12">
      <div className="border-border bg-card shadow-elev w-full max-w-md rounded-3xl border p-8">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="bg-peacock shadow-glow flex h-9 w-9 items-center justify-center rounded-full text-base">
              🦚
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">
              mesita.
            </span>
          </Link>
          <h1 className="font-display mt-6 text-2xl font-semibold tracking-tight">
            Welcome to Mesita
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Tell us who you are. You can add your venue right after.
          </p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            Signed in as {user.email}
          </p>
        </div>

        <ManagerOnboardForm />
      </div>
    </div>
  );
}
