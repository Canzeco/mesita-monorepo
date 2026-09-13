// The Overview — the organization's own page, in the ONE place its
// composition lives (MESITA-1807).
//
// It earns its name: Stripe and Members moved to their own routes, so what
// stays here is where things stand, with a link to each — Payments (the
// connect state), Partner (the org switch, which rides with Stripe on
// Payments), Members (people and pending invites), Places (what it holds) —
// then the three future boxes as Soon strips. Pato, 2026-09-05: "Prepaid
// Credits box · Mesita Capital box · Activity box as Soon."
//
// Sync and presentational on purpose: the page assembles the props, this
// file owns the composition, and the order test pins THIS file instead of
// mocking a server component's world.

import Link from "next/link";
import { Section } from "@/components/shared/Section";
import { DataRow, OrgStateBadge } from "@/components/console/badges";
import { SoonStrip } from "@/components/console/SoonStrip";
import type { Organization, PaymentAccount } from "@/lib/api/organizations";
import { orgHref, orgPlacesHref } from "@/lib/console-routes";

/** The box order, exported so the pin test asserts the product decision. */
export const ORG_OVERVIEW_ORDER = [
  "standing",
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

const ROW_LINK = "hover:underline underline-offset-4";

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Where things stand: one row per subpage, each a door to it. */
export function OrgStanding({
  org,
  account,
  memberCount,
  pendingCount,
  membersError,
}: {
  org: Organization;
  account: PaymentAccount | null;
  memberCount: number;
  pendingCount: number;
  membersError: string | null;
}) {
  const payments = orgHref(org.id, "payments");
  const members = orgHref(org.id, "members");
  const places = orgPlacesHref(org.id);
  return (
    <Section
      title="Where things stand"
      description="Each row opens its page."
    >
      <div>
        <DataRow label="Payments">
          <Link href={payments} className={ROW_LINK}>
            <OrgStateBadge
              state={account?.charges_enabled ? "connected" : "not_connected"}
            />
          </Link>
        </DataRow>
        <DataRow label="Partner">
          <Link href={payments} className={ROW_LINK}>
            {org.partnered === true ? "On" : "Off"}
          </Link>
        </DataRow>
        <DataRow label="Members">
          {membersError ? (
            <Link href={members} className={ROW_LINK}>
              {membersError}
            </Link>
          ) : (
            <Link href={members} className={ROW_LINK}>
              {count(memberCount, "member", "members")}
              {pendingCount > 0 ? ` · ${count(pendingCount, "invite pending", "invites pending")}` : ""}
            </Link>
          )}
        </DataRow>
        <DataRow label="Places">
          <Link href={places} className={ROW_LINK}>
            {org.placeCount === 0
              ? "None yet — claim one"
              : count(org.placeCount, "held", "held")}
          </Link>
        </DataRow>
      </div>
    </Section>
  );
}

/** The three future boxes. */
export function OrgSoon() {
  return (
    <>
      <SoonStrip {...SOON_STRIPS.credits} />
      <SoonStrip {...SOON_STRIPS.capital} />
      <SoonStrip {...SOON_STRIPS.activity} />
    </>
  );
}
