// The Organization screen's six boxes, in the ONE place their order lives.
//
// Pato, 2026-09-05: "Organization must contain mainly: Members box · Stripe
// Account box · Prepaid Credits box · Mesita Capital box · Activity box as
// Soon." Read as an inventory; the vertical order is funnel-first (approved
// at the autoplan gate, 2026-09-06): the live edge — Stripe state and its
// CTA — leads, people and holdings follow, the three future boxes close the
// page as one-line Soon strips.
//
// Sync and presentational on purpose: the server page assembles the props,
// this component owns the composition, and the order test pins THIS file
// instead of mocking a server component's world.

import Link from "next/link";
import { Section } from "@/components/shared/Section";
import { DataRow } from "@/components/console/badges";
import { MembersCard } from "@/components/console/MembersCard";
import { OrgIdentityCard } from "@/components/console/OrgIdentityCard";
import { PaymentsCard } from "@/components/console/PaymentsCard";
import { SoonStrip } from "@/components/console/SoonStrip";
import type {
  Organization,
  OrgMember,
  PaymentAccount,
  PendingOrgInvite,
} from "@/lib/api/organizations";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import { GHOST_PILL_BUTTON_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";

/** The box order, exported so the pin test asserts the product decision. */
export const ORG_SCREEN_ORDER = [
  "stripe",
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
  return (
    <>
      <Section
        title="Stripe Account"
        description="The account this organization gets paid through."
      >
        <div className="flex flex-col gap-4">
          <PaymentsCard
            orgId={org.id}
            account={account}
            orphaned={orphaned}
            isOwner={isOwner}
            hasLegalName={Boolean(org.legalName)}
          />
          <OrgIdentityCard
            orgId={org.id}
            legalName={org.legalName}
            rfc={org.rfc}
            currency={org.currency}
            isOwner={isOwner}
            hasAccount={account !== null}
          />
        </div>
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
              href={withOrg(SHELL_ROUTES.places, org.id)}
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
              None yet. Every place starts in the public pool.
            </p>
            <Link
              href={withOrg(SHELL_ROUTES.pool, org.id)}
              className={PILL_BUTTON_CLASS}
            >
              Claim from the pool
            </Link>
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
