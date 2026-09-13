// Settings — "org & place settings" (Pato, 2026-09-13; MESITA-1832): the
// selected place's Settings (what guests can do here) and the organization's
// Members, one page. The place half needs PlaceContext, which the (place)
// layout provides; the Members half is the organization's read.
import { notFound } from "next/navigation";
import { MembersCard } from "@/components/console/MembersCard";
import { apiListOrgMembers, type OrgMember, type PendingOrgInvite } from "@/lib/api/organizations";
import { getManagePlace } from "@/lib/place-view";
import { tabsForAccess } from "@/lib/place-tabs";
import { getSelection } from "@/lib/selected-place";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { SettingsTab } from "./SettingsTab";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { org, placeId } = await getSelection();
  const manage = placeId ? await getManagePlace(placeId) : null;
  if (!manage || !org) notFound();
  const user = await getServerUser();
  const supabase = await createServerSupabase();

  // Editors and owners see the place's switches; a viewer reads Members only
  // (the ONE matrix, lib/place-tabs).
  const mayEditPlace = tabsForAccess({
    held: true,
    role: org.myRole,
    isSuperAdmin: manage.isSuperAdmin,
  }).includes("settings");

  let members: OrgMember[] = [];
  let pendingInvites: PendingOrgInvite[] = [];
  let membersError: string | null = null;
  try {
    ({ members, pendingInvites } = await apiListOrgMembers(supabase, org.id));
  } catch (e) {
    membersError = "Couldn't load members.";
    console.error("[settings] business-web-list-org-members:", e);
  }

  return (
    <>
      {mayEditPlace && <SettingsTab />}
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
