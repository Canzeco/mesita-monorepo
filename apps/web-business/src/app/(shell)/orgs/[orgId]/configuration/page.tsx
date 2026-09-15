// Configuration — THE ORGANIZATION'S OWN SETUP, and nothing else
// (MESITA-1852, trimmed to what you configure in MESITA-1869).
//
// Pato, 2026-09-14, on the Settings page this replaced: *"Remove places from
// here, its redundant. five boxes: brand · members · stripe · partnership ·
// developers. change name of settings to configuration."* Then, 2026-09-15,
// listing the rail: *"Configuration (here have members shit) · Products (here
// have partner and all the products to activate…)."*
//
// SO THE TWO PAID BOXES LEFT. Mesita Partner and Mesita Pay were here for one
// day, and they were the right boxes in the wrong room: a subscription and a
// payment account are PRODUCTS — things you buy and turn on — not things you
// configure about an organization. The catalogue is where an operator goes to
// buy, so that is where they went, composition intact (MESITA-1866's account /
// seam / switch, MESITA-1867's two tiers). Stripe's stored `?connect=` follows
// them: the bare `/orgs/<id>` forwards it to Products now.
//
// WHAT IS LEFT IS THREE BOXES, and they are the three the name covers: who may
// touch this organization, what it looks like, and how an agent drives it.
//
// PLACES LEFT EARLIER (MESITA-1852). It has a rail row two lines above this
// page, and a box listing them again was the second door to one room.
//
// SETTINGS IS CONFIGURATION, label AND segment. "Settings" is a word this
// repo has burned twice (MESITA-1815 renamed a place view to it, MESITA-1841
// reversed that), and the flat `/settings` is still owned by a permanent
// legacy redirect onto `/capabilities` — which is why this page had no flat
// twin. `configuration` is unclaimed, so it has one.
//
// THE HEADER WRAPPER (MESITA-1861). The shell column is `gap-4` and this page
// is a fragment, so an unwrapped `h1` + `p` sat 16px apart — the identical gap
// the column puts between two unrelated cards, and the caption read as
// floating. One wrapper, `gap-1`, and proximity says what it should.
//
// TWO BOXES ARE HONEST ABOUT BEING UNBUILT. Brand wants a logo and the
// loyalty card's colour; `Organization` carries neither column. Developers
// wants API keys. Both show Soon on the PAGE rather than a dimmed row in the
// rail (MESITA-1833, MESITA-1845).
import { notFound, redirect } from "next/navigation";
import { MembersCard } from "@/components/console/MembersCard";
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";
import {
  apiListOrgMembers,
  apiListOrganizations,
  type OrgMember,
  type PendingOrgInvite,
} from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import { orgHref } from "@/lib/console-routes";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "Owner", editor: "Editor", viewer: "Viewer" } as const;

export default async function ConfigurationPage(props: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await props.params;
  const supabase = await createServerSupabase();
  const [user, organizations] = await Promise.all([
    getServerUser(),
    apiListOrganizations(supabase),
  ]);
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(orgHref(orgId))}`);
  }
  const org = findOrg(organizations, orgId);
  if (!org) notFound();

  let members: OrgMember[] = [];
  let pendingInvites: PendingOrgInvite[] = [];
  let membersError: string | null = null;
  try {
    ({ members, pendingInvites } = await apiListOrgMembers(supabase, org.id));
  } catch (e) {
    membersError = "Couldn't load members.";
    console.error("[configuration] business-web-list-org-members:", e);
  }

  const isOwner = org.myRole === "owner";

  return (
    <>
      {/* The caption BELONGS to the title (MESITA-1861). */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {org.name}
        </h1>
        <p className="text-muted-foreground text-sm leading-snug">
          You are {ROLE_LABEL[org.myRole]} here.
        </p>
      </div>

      <MembersCard
        orgId={org.id}
        members={members}
        pendingInvites={pendingInvites}
        myManagerId={user.id}
        isOwner={isOwner}
        loadError={membersError}
      />

      <SoonStrip {...SOON_STRIPS.brand} />
      <SoonStrip {...SOON_STRIPS.developers} />
    </>
  );
}
