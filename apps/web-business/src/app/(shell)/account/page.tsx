// Account — the signed-in human, and the organizations they belong to.
// One account may be in many; this is where that is visible.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Section } from "@/components/shared/Section";
import { DataRow } from "@/components/console/badges";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiListOrganizations } from "@/lib/api/organizations";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/account");

  const orgs = await apiListOrganizations(supabase).catch(() => []);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Account
      </h1>

      <Section title="You" right={<SignOutButton redirectTo="/signin" />}>
        <div>
          <DataRow label="Email">{user.email ?? "—"}</DataRow>
          <DataRow label="Organizations">{orgs.length}</DataRow>
        </div>
      </Section>

      <Section
        title="Your organizations"
        description="An account can belong to several. Switching one changes every screen."
      >
        {orgs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            None yet.{" "}
            <Link href={SHELL_ROUTES.organization} className="underline">
              Create one
            </Link>
            .
          </p>
        ) : (
          <div>
            {orgs.map((o) => (
              <DataRow key={o.id} label={o.name}>
                <Link
                  href={withOrg(SHELL_ROUTES.organization, o.id)}
                  className="hover:underline"
                >
                  <span className="capitalize">{o.myRole}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {o.placeCount} place{o.placeCount === 1 ? "" : "s"}
                  </span>
                </Link>
              </DataRow>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
