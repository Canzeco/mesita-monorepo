// Settings — THE ORGANIZATION'S OWN SETUP, and nothing else.
//
// Pato, 2026-09-14, on the page this replaced: *"Remove places from here, its
// redundant. five boxes: brand · members · stripe · partnership ·
// developers."* Then, 2026-09-15: *"Configuration (here have members shit) ·
// Products (here have partner and all the products to activate…)"*, then
// *"remove brand configuration from here"*, then *"rename configuration to
// settings and use to normal settings icon."*
//
// WHAT IS LEFT IS TWO BOXES, and they are the two the name covers: who may
// touch this organization, and how an agent drives it.
//
// THE TWO PAID BOXES LEFT (MESITA-1869). Mesita Partner and Mesita Pay were
// the right boxes in the wrong room: a subscription and a payment account are
// PRODUCTS — things you buy and turn on — not things you set about an
// organization. The catalogue is where an operator goes to buy, so that is
// where they went, composition intact (MESITA-1866's account / seam / switch,
// MESITA-1867's two tiers). Stripe's stored `?connect=` follows them: the bare
// `/orgs/<id>` forwards it to Products.
//
// BRAND LEFT AFTER THEM (MESITA-1870). It was the second Soon on a page just
// cut to what you actually set, and the weaker of the two: Developers is
// something this organization will DO — keys it holds, an agent it drives —
// while a logo and the colour the loyalty card wears is a design decision with
// no column, no owner and no next step. Two dashed rows under one live box
// read as a page that is mostly not built; one reads as a page with one thing
// coming.
//
// PLACES LEFT EARLIEST (MESITA-1852). It has a rail row two lines above this
// page, and a box listing them again was the second door to one room.
//
// THE NAME IS SETTINGS, LABEL AND SEGMENT (MESITA-1871). It was Settings for
// one day in MESITA-1841, Configuration from MESITA-1852, and the rename was
// forced rather than chosen: the flat `/settings` was owned by a PERMANENT
// legacy redirect onto `/capabilities`, so the page it named could never carry
// a flat twin. That rule is deleted (`next.config.ts`), checked first against
// the live 308's `must-revalidate`, so the name resolves instead of being
// shadowed. Both spellings of `configuration` forward here.
//
// THE HEADER WRAPPER (MESITA-1861). The shell column is `gap-4` and this page
// is a fragment, so an unwrapped `h1` + `p` sat 16px apart — the identical gap
// the column puts between two unrelated cards, and the caption read as
// floating. One wrapper, `gap-1`, and proximity says what it should.
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

export default async function SettingsPage(props: {
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
    console.error("[settings] business-web-list-org-members:", e);
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

      <SoonStrip {...SOON_STRIPS.developers} />
    </>
  );
}
