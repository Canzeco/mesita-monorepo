"use client";

// THE CATALOGUE'S HEADLINE (MESITA-1869): what this place's partnership buys,
// said once, above the eight cards it gates.
//
// Pato's mock draws it as ONE horizontal strip — a green check, the name, an
// "Active" chip, a seam, and one line saying the products come with the
// partnership. That is the right shape for a settled fact: a partner has
// nothing to do here, and a full box for nothing-to-do outranks the eight
// cards that DO have something to do.
//
// SO THE STRIP IS THE PARTNERED STATE ONLY. Not a partner, the same slot
// renders `PartnerCard` inside a Section — the price at display rank, the
// owner's one CTA, the price list under a hairline, and the modal
// (MESITA-1867's composition, unchanged). Rank by depth, the rule SoonStrip
// wrote: the state with a decision in it gets the box, the state without gets
// the line.
//
// ONE STATUS NOUN: **Partner**. The strip says what the place IS, and that is
// the word the pill, the badge and the guest-facing rail all use.
// "Membership" names the thing it BOUGHT and appears only where money does
// (MESITA-1877) — so the mock's "included with your membership" is still
// written as partnership here.
//
// AND IT CARRIES THE DOOR OUT (MESITA-1891). A settled fact still needs one
// verb: cancel, or the invoices and the card behind it. That verb is Stripe's
// Billing Portal, owner-only, and it is the SAME `ManageMembership` the box
// below renders — the strip is just where a partner actually lands.
//
// AND THE STRIP PRINTS THE DATE (MESITA-1877). "Renews yearly" was all the
// console knew before there was a subscription; now that there is one, the
// settled fact includes WHEN, and `membershipLine` is the one place that
// decides how to say it — including the two ways it must not: never "renews"
// for a membership that is ending, never "over" for one Stripe is still
// dunning.

import { Check } from "lucide-react";
import {
  ManageMembership,
  membershipLine,
  PartnerCard,
} from "@/components/console/PartnerCard";
import { Section } from "@/components/shared/Section";
import type { Membership, MembershipPrice } from "@/lib/api/console";

export function PartnerBanner({
  placeId,
  partnered,
  isOwner,
  membership = null,
  price = null,
}: {
  placeId: string;
  partnered: boolean;
  isOwner: boolean;
  membership?: Membership | null;
  price?: MembershipPrice | null;
}) {
  if (!partnered) {
    return (
      <Section
        lane
        title="Mesita Partner"
        description="This place's yearly partnership, bought once a year."
      >
        <PartnerCard
          placeId={placeId}
          partnered={false}
          isOwner={isOwner}
          price={price}
        />
      </Section>
    );
  }

  return (
    <div className="border-border bg-card shadow-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border p-4">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
      <h2 className="font-display text-sm font-semibold tracking-tight">
        Mesita Partner
      </h2>
      {/* The chip is the STATE, so it changes when the state does: a card
          Stripe is retrying is not "Active", and the strip must not be the
          one surface that says everything is fine. Amber, not red — the
          partnership is intact and nothing has been taken away. */}
      {membership?.state === "past_due"
        ? (
          <span className="inline-flex items-center rounded-full bg-amber-500/14 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            Payment due
          </span>
        )
        : (
          <span className="inline-flex items-center rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            Active
          </span>
        )}
      {/* The seam is the strip's only chrome: it separates the FACT on the
          left from what the fact buys on the right, which is the whole
          sentence. It disappears when the row wraps, where the wrap itself is
          the separation. */}
      <span aria-hidden className="bg-border hidden h-6 w-px sm:block" />
      <p className="text-muted-foreground min-w-0 text-[13px] leading-snug">
        Product access included with your partnership. {membershipLine(
          membership,
        )}
      </p>
      {/* THE DOOR OUT (MESITA-1891). The strip is the partnered face an
          operator actually meets — `PartnerCard`'s own partnered branch is
          only reached by its tests — so the Billing Portal link has to be
          here or it is nowhere. Same component both places, so the two can
          never offer different doors. It is last on the row and wears the
          strip's own quiet underline: managing a settled fact must not
          outrank the fact. */}
      <ManageMembership placeId={placeId} isOwner={isOwner} />
    </div>
  );
}
