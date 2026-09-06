// Account — the signed-in human, and the organizations they belong to.
// One account may be in many; this is where that is visible, and — since
// the five-box recomposition — where a new one is created: creation
// belongs beside the list, as a disclosure, never a permanently mounted
// form (the read-first law).
//
// An organizations fetch failure is an ERROR, not "None yet": with a
// create disclosure on this page, rendering the empty state on a transient
// failure would invite creating a duplicate organization.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Section } from "@/components/shared/Section";
import { DataRow } from "@/components/console/badges";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { AddOrganizationDisclosure } from "@/components/console/AddOrganizationDisclosure";
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

  let orgs: Awaited<ReturnType<typeof apiListOrganizations>> = [];
  let orgsError = false;
  try {
    orgs = await apiListOrganizations(supabase);
  } catch (e) {
    orgsError = true;
    console.error("[account] business-web-list-organizations:", e);
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Account
      </h1>

      <Section title="You" right={<SignOutButton redirectTo="/signin" />}>
        <div>
          <DataRow label="Email">{user.email ?? "—"}</DataRow>
          <DataRow label="Organizations">
            {orgsError ? "—" : orgs.length}
          </DataRow>
        </div>
      </Section>

      <Section
        title="Your organizations"
        description="An account can belong to several. Switching one changes every screen."
      >
        {orgsError ? (
          <p className="text-muted-foreground text-sm">
            Couldn&apos;t load your organizations. Reload to try again.
          </p>
        ) : orgs.length === 0 ? (
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

      {!orgsError && orgs.length > 0 && <AddOrganizationDisclosure />}
    </>
  );
}
