import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createServerSupabase } from "@/lib/supabase/server";
import { efInvoke } from "@/lib/supabase-ef";
import { authSignOut } from "@/app/auth/actions";

// Admin shell layout. Two gates, in order:
//
//   1. Signed-in via Supabase (Google OAuth). The middleware bounces
//      anonymous users to /.
//   2. The signed-in email is in public.super_admins. auth-get-identity
//      does the lookup.
//      Non-allowlisted operators get a polite "not authorised" empty state —
//      the EFs themselves also re-check, so even if someone bypassed this
//      gate, no privileged action would go through.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const whoami = await efInvoke<{ email: string | null; isSuperAdmin: boolean }>(
    "admin-web-get-identity",
    {},
  );

  if (!whoami.ok) {
    return (
      <div className="bg-hero flex min-h-dvh items-center justify-center px-4">
        <div className="border-border bg-card shadow-elev flex w-full max-w-md flex-col gap-4 rounded-2xl border p-6 text-center">
          <span className="bg-muted mx-auto flex h-10 w-10 items-center justify-center rounded-full">
            <Shield className="text-muted-foreground h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Could not verify access
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Signed in as{" "}
              <span className="text-foreground font-semibold">
                {user.email ?? "(no email)"}
              </span>
              , but the admin identity check failed: {whoami.error}
            </p>
          </div>
          <form action={authSignOut}>
            <button
              type="submit"
              className="bg-foreground text-background mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!whoami.data.isSuperAdmin) {
    return (
      <div className="bg-hero flex min-h-dvh items-center justify-center px-4">
        <div className="border-border bg-card shadow-elev flex w-full max-w-md flex-col gap-4 rounded-2xl border p-6 text-center">
          <span className="bg-muted mx-auto flex h-10 w-10 items-center justify-center rounded-full">
            <Shield className="text-muted-foreground h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Not authorised
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              You&apos;re signed in as{" "}
              <span className="text-foreground font-semibold">
                {user.email ?? "(no email)"}
              </span>
              , but that account isn&apos;t on the super-admin list. Ask an
              existing admin to add you.
            </p>
          </div>
          <form action={authSignOut}>
            <button
              type="submit"
              className="bg-foreground text-background mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90"
            >
              Sign out
            </button>
          </form>
          <p className="text-muted-foreground text-[11px]">
            Trying to sign in as someone else?{" "}
            <Link href="/" className="font-semibold underline">
              Back to sign-in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>{children}</AppShell>
  );
}
