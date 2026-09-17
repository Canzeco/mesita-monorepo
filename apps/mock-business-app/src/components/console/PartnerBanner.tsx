"use client";

// THE CATALOGUE'S HEADLINE: what this place's membership buys, said once,
// above the eight cards it gates (MESITA-1927).
//
// RANK BY DEPTH. The state with a decision in it gets the box; the state
// without gets the line. Not a partner is a real decision — a price and a
// purchase — so it takes a full card. A partner has nothing to do here, and a
// full box for nothing-to-do outranks eight cards that DO have something to
// do. That was the bug in the banner this replaces: the loudest surface on
// the page was the one with no verb on it.
//
// AND THE STRIP CARRIES THE FACT AGAIN (MESITA-1943). It used to omit the
// **Partner** badge on purpose: `PlaceHeading` put one top-right of every place
// view, so stating it here too was the same fact twice, a hundred pixels apart,
// against `shared/Badges.tsx`'s opening rule. The heading is gone, and this is
// the screen that inherits the fact rather than the one that loses it — the
// catalogue is where a partner's eight cards unlock, so the gate belongs above
// the things it gates.
//
// Nothing else on the page says it. Settings › States lists Partner among
// eleven rows, which is a reference table, not the catalogue's headline; the
// membership line beside this badge says when it RENEWS, which implies the
// fact without ever stating it. Deleting the heading without this line would
// have left the partnered catalogue silently unable to say why it is open.
//
// The badge answers what the place IS; the line answers what the membership is
// DOING. The chip is neither, and comes back only when the state is not plain
// active — see `membershipChip`.
import {
  ManageMembership,
  membershipChip,
  membershipLine,
  PartnerCard,
} from "@/components/console/PartnerCard";
import { Badge } from "@/components/shared/Badges";
import type { MockPlace } from "@/mock/types";
import { cn } from "@/lib/utils";

export function PartnerBanner({ place }: { place: MockPlace }) {
  if (!place.partnered) {
    return (
      <div className="border-border bg-card rounded-2xl border p-4">
        <PartnerCard place={place} />
      </div>
    );
  }

  const { lead, rest } = membershipLine(place);
  const chip = membershipChip(place.membership);

  return (
    <div className="border-border bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3">
      <h2 className="font-display text-sm font-semibold tracking-tight">
        Membership
      </h2>
      {/* The fact, in the tone it has always had. `gold` is one of the two
          reserved chromas — a tier the product names out loud — and it holds
          7.8:1 on this white card, which is the reason the facts stayed on
          paper rather than moving onto an ink header. */}
      <Badge tone="gold">Partner</Badge>
      {chip && (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
            chip.tone,
          )}
        >
          {chip.label}
        </span>
      )}
      {/* The seam separates the FACT on the left from what the fact buys on
          the right, which is the whole sentence. It disappears when the row
          wraps, where the wrap itself is the separation. */}
      <span aria-hidden className="bg-border hidden h-6 w-px sm:block" />
      {/* `grow basis-72`, not `flex-1`. `flex-1` is `basis-0`, so on a phone
          this sentence shrank to whatever was left beside the link — six
          characters a line, with the link still sitting on the same row. A
          basis wider than a phone forces the WRAP instead, which is what the
          wrap was for. Desktop is unchanged: it still grows into the slack and
          pushes the link to the right edge. */}
      <p className="min-w-0 grow basis-72 text-[13px] leading-snug">
        <span className="font-medium">{lead}</span>{" "}
        <span className="text-muted-foreground">{rest}</span>
      </p>
      {/* THE DOOR OUT. The strip is the partnered face an operator actually
          meets, so the way to cancel, pay a failed invoice or change the card
          has to be here or it is nowhere. Last on the row and quiet:
          managing a settled fact must not outrank the fact. */}
      <ManageMembership place={place} />
    </div>
  );
}
