// The Organization page's boxes, in the ONE place their order lives.
//
// Pato, 2026-09-05: "Organization must contain mainly: Members box · Stripe
// Account box · Prepaid Credits box · Mesita Capital box · Activity box as
// Soon." Read as an inventory. MESITA-1798 adds Partner immediately after
// Stripe: one binary switch, same grammar as a Capabilities row. Funnel
// first (approved at the autoplan gate, 2026-09-06): Stripe, then Partner,
// then people and holdings, then the three future boxes as Soon strips.
//
// ONE PAGE (MESITA-1810). MESITA-1807 split Stripe and Members into routes
// of their own for a day; Pato, on seeing it live: "organization all in the
// same page, don't separate organization and overview and members and
// payments." So the organization's page is these boxes, `/orgs/<id>`, and
// the rail's Organization row is its door.
//
// Sync and presentational on purpose: the server page assembles the props,
// this component owns the composition, and the order test pins THIS file
// instead of mocking a server component's world.

import Link from "next/link";
import { Section } from "@/components/shared/Section";
import { DataRow } from "@/components/console/badges";
import { MembersCard } from "@/components/console/MembersCard";
import { PartnerCard } from "@/components/console/PartnerCard";
import { PaymentsCard } from "@/components/console/PaymentsCard";
import { SoonStrip } from "@/components/console/SoonStrip";
import type {
  Organization,
  OrgMember,
  PaymentAccount,
  PendingOrgInvite,
} from "@/lib/api/organizations";
import { orgPlacesHref, orgPlacesNewHref } from "@/lib/console-routes";
import { canAddPlace } from "@/lib/active-organization";
import { GHOST_PILL_BUTTON_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";

/** The box order, exported so the pin test asserts the product decision. */
export const ORG_SCREEN_ORDER = [
  "stripe",
  "partner",
  "members",
  "places",
  "credits",
  "capital",
  "activity",
] as const;

export const SOON_STRIPS: Record<
  "credits" | "capital" | "activity",
  { title: string; line: string }
> = {
  credits: {
    title: "Prepaid Credits",
    line: "The organization's Credits balance, terms, and outstanding liability will live here.",
  },
  capital: {
    title: "Mesita Capital",
    line: "Financing built on your settlement history — in development.",
  },
  activity: {
    title: "Activity",
    line: "Everything that happens in this organization — one feed.",
  },
};

export function OrgScreenSections({
  org,
  myManagerId,
  account,
  orphaned,
  members,
  pendingInvites,
  membersError,
}: {
  org: Organization;
  myManagerId: string;
  account: PaymentAccount | null;
  orphaned: boolean;
  members: OrgMember[];
  pendingInvites: PendingOrgInvite[];
  membersError: string | null;
}) {
  const isOwner = org.myRole === "owner";
  const stripeReady =
    account !== null &&
    account.charges_enabled === true &&
    account.details_submitted === true &&
    !orphaned;
  return (
    <>
      <Section
        title="Stripe Account"
        description="The account this organization gets paid through."
      >
        <PaymentsCard
          orgId={org.id}
          account={account}
          orphaned={orphaned}
          isOwner={isOwner}
        />
      </Section>

      <Section
        title="Partner"
        description="One switch for this organization. Free. Unlocks Mesita Pay, Visit Rewards and Accept Prepays at every held place."
      >
        <PartnerCard
          key={`${org.id}-${org.partnered === true ? "on" : "off"}`}
          orgId={org.id}
          partnered={org.partnered === true}
          stripeReady={stripeReady}
          isOwner={isOwner}
        />
      </Section>

      <MembersCard
        orgId={org.id}
        members={members}
        pendingInvites={pendingInvites}
        myManagerId={myManagerId}
        isOwner={isOwner}
        loadError={membersError}
      />

      <Section
        title="Places"
        description="What this organization holds."
        right={
          org.placeCount > 0 ? (
            <Link
              href={orgPlacesHref(org.id)}
              className={GHOST_PILL_BUTTON_CLASS}
            >
              Manage
            </Link>
          ) : undefined
        }
      >
        {org.placeCount === 0 ? (
          // Zero is not a data point worth a row. It is a next step.
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {canAddPlace(org.myRole)
                ? "None yet. Search for the place. If Mesita has it, add it to this organization. If not, create it."
                : "This organization has no places."}
            </p>
            {canAddPlace(org.myRole) ? (
              <Link
                href={orgPlacesNewHref(org.id)}
                className={PILL_BUTTON_CLASS}
              >
                Add place
              </Link>
            ) : null}
          </div>
        ) : (
          <div>
            <DataRow label="Held">{org.placeCount}</DataRow>
          </div>
        )}
      </Section>

      <SoonStrip {...SOON_STRIPS.credits} />
      <SoonStrip {...SOON_STRIPS.capital} />
      <SoonStrip {...SOON_STRIPS.activity} />
    </>
  );
}
