// Members — who may sign in to THIS ORGANIZATION, and at what role.
//
// It was the bottom half of `/settings` until MESITA-1839, sharing a page with
// the selected place's switches. Two nouns, one address: the place's switches
// travel with the place, while who may sign in outlives every place the
// organization holds. They are two pages now, and each one's URL says which.
import { notFound } from "next/navigation";
import { MembersCard } from "@/components/console/MembersCard";
import {
  apiListOrgMembers,
  apiListOrganizations,
  type OrgMember,
  type PendingOrgInvite,
} from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrgMembersPage(props: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await props.params;
  const supabase = await createServerSupabase();
  // The segment layout above already refused a foreign id; this read is for
  // `myRole`, which decides whether the card offers Invite.
  const [user, organizations] = await Promise.all([
    getServerUser(),
    apiListOrganizations(supabase),
  ]);
  const org = findOrg(organizations, orgId);
  if (!org) notFound();

  let members: OrgMember[] = [];
  let pendingInvites: PendingOrgInvite[] = [];
  let membersError: string | null = null;
  try {
    ({ members, pendingInvites } = await apiListOrgMembers(supabase, org.id));
  } catch (e) {
    membersError = "Couldn't load members.";
    console.error("[members] business-web-list-org-members:", e);
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Members</h1>
      <MembersCard
        orgId={org.id}
        members={members}
        pendingInvites={pendingInvites}
        myManagerId={user?.id ?? ""}
        isOwner={org.myRole === "owner"}
        loadError={membersError}
      />
    </>
  );
}
