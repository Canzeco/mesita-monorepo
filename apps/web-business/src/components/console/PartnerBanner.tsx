"use client";

// THE CATALOGUE'S HEADLINE (MESITA-1869): what the organization's partnership
// buys, said once, above the eight cards it gates.
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
// "MEMBERSHIP" IS BANNED in this console (package CLAUDE.md), so the mock's
// "included with your membership" is written with the word the product
// actually uses. One vocabulary, everywhere.

import { Check } from "lucide-react";
import { PartnerCard } from "@/components/console/PartnerCard";
import { Section } from "@/components/shared/Section";

export function PartnerBanner({
  partnered,
  isOwner,
}: {
  partnered: boolean;
  isOwner: boolean;
}) {
  if (!partnered) {
    return (
      <Section
        lane
        title="Mesita Partner"
        description="The organization's yearly partnership. Every place it holds is in."
      >
        <PartnerCard partnered={false} isOwner={isOwner} />
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
      <span className="inline-flex items-center rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        Active
      </span>
      {/* The seam is the strip's only chrome: it separates the FACT on the
          left from what the fact buys on the right, which is the whole
          sentence. It disappears when the row wraps, where the wrap itself is
          the separation. */}
      <span aria-hidden className="bg-border hidden h-6 w-px sm:block" />
      <p className="text-muted-foreground min-w-0 text-[13px] leading-snug">
        Product access included with your partnership. Renews yearly.
      </p>
    </div>
  );
}
