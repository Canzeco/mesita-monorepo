// Account — the signed-in human, and the two switchers (MESITA-1832):
// which organization, which place. The organization's places (the list, Add
// place) are reached from the place switcher's menu.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Section } from "@/components/shared/Section";
import { ScopeSwitchers } from "@/components/console/ScopeSwitchers";
import { DataRow } from "@/components/console/badges";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { apiListOrganizations } from "@/lib/api/organizations";
import { SHELL_ROUTES, orgHref } from "@/lib/console-routes";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createServerSupabase();
  // getServerUser, not supabase.auth.getUser: the shell layout above already
  // validated this JWT over the network this request, and cache() hands back
  // that answer instead of asking again (MESITA-1729).
  const user = await getServerUser();
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

      {/* "Account must contain select account, organization selector, and
          place selector" (Pato, 2026-09-13; MESITA-1832). */}
      <ScopeSwitchers />

      <Section title="You" right={<SignOutButton redirectTo="/signin" />}>
        <div>
          <DataRow label="Email">{user.email ?? "—"}</DataRow>
          <DataRow label="Organizations">
            {orgsError ? (
              "—"
            ) : orgs.length === 0 ? (
              <Link href={SHELL_ROUTES.orgNew} className="underline">
                Create one
              </Link>
            ) : (
              <Link
                href={
                  orgs.length === 1 ? orgHref(orgs[0].id) : SHELL_ROUTES.root
                }
                className="hover:underline"
              >
                {orgs.length}
              </Link>
            )}
          </DataRow>
        </div>
      </Section>
    </>
  );
}
