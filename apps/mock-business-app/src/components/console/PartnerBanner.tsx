"use client";

// PLAN'S HEADLINE: what this place's rung buys, said once (MESITA-1927).
//
// IT IS THE PLAN SCREEN'S NOW, NOT THE CATALOGUE'S (MESITA-2012). It headed
// the product grid, then Mesita Partner's product pane; both were the wrong
// room for a Manage-plan door, which is why `PlanPane` is the only caller
// left. The ranking argument below is unchanged and is why this file did not
// collapse into that one.
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
  ManagePlan,
  membershipChip,
  PartnerCard,
} from "@/components/console/PartnerCard";
import type { MockPlace } from "@/mock/types";
import { cn } from "@/lib/utils";

export function PartnerBanner({ place }: { place: MockPlace }) {
  // THE BRANCH IS THE BILL, NOT THE BADGE (2026-09-20). It read `partnered`,
  // which meant the same thing right up until the badge moved to Mesita Pro.
  // A place on Mesita Start pays every month, and this line deciding on the
  // badge would take its Manage plan door away and hand it a buy button for
  // something it already subscribes to.
  if (place.plan === "free") {
    return (
      <div className="border-border bg-card rounded-2xl border p-4">
        <PartnerCard place={place} />
      </div>
    );
  }

  const chip = membershipChip(place.membership);

  return (
    <div className="border-border bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3">
      {/* WHAT THE HEADING ABOVE CANNOT SAY (MESITA-1997). The Plan page's
          header states the rung and the renewal line; this strip used to
          state both again, one gap below, which was the same fact twice in
          two type sizes — the thing `shared/Badges.tsx` opens by forbidding.
          It kept the two pieces the heading has no room for: that Stripe is
          retrying or this is ending, and the way out. */}
      {chip ? (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
            chip.tone,
          )}
        >
          {chip.label}
        </span>
      ) : (
        <p className="text-muted-foreground min-w-0 grow basis-72 text-[13px] leading-snug">
          Change the rung, see the invoices, or update the card.
        </p>
      )}
      {/* THE DOOR OUT. The strip is the partnered face an operator actually
          meets, so the way to cancel, pay a failed invoice or change the card
          has to be here or it is nowhere. */}
      <ManagePlan place={place} />
    </div>
  );
}
