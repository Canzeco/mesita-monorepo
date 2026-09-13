// Members — who is in the organization (MESITA-1807: its own route, off
// the one-scroll Organization screen).
import { redirect } from "next/navigation";
import { MembersCard } from "@/components/console/MembersCard";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import {
  apiListOrgMembers,
  type OrgMember,
  type PendingOrgInvite,
} from "@/lib/api/organizations";
import { requireOrg } from "@/lib/org-scope";

export const dynamic = "force-dynamic";

export default async function OrganizationMembersPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createServerSupabase();
  // getServerUser, not supabase.auth.getUser: the shell layout above already
  // validated this session, and cache() hands back that answer.
  const user = await getServerUser();
  if (!user) redirect("/signin");
  const org = await requireOrg(supabase, orgId);

  // The members read NEVER degrades to an empty list — zero members is
  // impossible (the creator is owner), so an empty render would be a lie.
  let members: OrgMember[] = [];
  let pendingInvites: PendingOrgInvite[] = [];
  let membersError: string | null = null;
  try {
    ({ members, pendingInvites } = await apiListOrgMembers(supabase, org.id));
  } catch (e) {
    membersError = "Couldn't load members.";
    console.error("[orgs/members] business-web-list-org-members:", e);
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Members
      </h1>
      <MembersCard
        orgId={org.id}
        members={members}
        pendingInvites={pendingInvites}
        myManagerId={user.id}
        isOwner={org.myRole === "owner"}
        loadError={membersError}
      />
    </>
  );
}
