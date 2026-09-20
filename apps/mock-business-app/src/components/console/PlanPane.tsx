"use client";

// PLAN — what this place pays Mesita, and the three rungs it could pay
// instead (MESITA-2012).
//
// Pato, looking at Mesita Partner with the ladder on it: *"this goes into
// plan, not mesita partner, different things."*
//
// ── THE SPLIT ──────────────────────────────────────────────────────────────
//
// MESITA-2011 made `partner` a product and handed it the Plan row's whole
// screen — the renewal line, the Manage strip, the four-rung ladder. That is
// one screen answering two questions:
//
//   PLAN is a PURCHASE. A rung, a price, a renewal date, a card, invoices,
//   and the door to Stripe's Billing Portal. It is a decision with money in
//   it and it is the same decision on every place you hold.
//
//   MESITA PARTNER is a STATUS. A badge a guest sees, granted by any paid
//   rung and never switched on its own. Nothing on it can be bought, because
//   what you buy is the rung.
//
// Collapsing them put a price grid inside a product card whose own badge said
// `On`, which is the grid-grammar objection `PartnerCard`'s header has been
// making since MESITA-1927 — read from the other direction. The product row
// survives the split; what leaves it is the checkout.
//
// ── SO THE PLAN ROW COMES BACK, AND IT IS NOT A PRODUCT ────────────────────
//
// `sidebar-rows.ts` has it between Place and Settings, which is where it sat
// before MESITA-2011 deleted it: the two destinations that are not products
// become three. It is NOT a `ProductKey` and gets no Setup/Activity pair —
// `/places/<id>/plan` is one screen, like `/settings`.
//
// THE BODY IS THIS FILE AND THE HEADER IS THE PAGE'S. Same division every
// product pane uses, so the rung badge and the renewal blurb are drawn by
// `PageHeader` once rather than by a component that also draws a ladder.
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { PlanComparison } from "@/components/console/PlanComparison";
import type { MockPlace } from "@/mock/types";

export function PlanPane({ place }: { place: MockPlace }) {
  return (
    <div className="flex flex-col gap-4">
      {/* A PAYING place gets the DOOR and the ladder below it; a Free place
          gets `PartnerCard`'s ladder, which carries the buy doors. */}
      <PartnerBanner place={place} />
      {/* THE LADDER, FOR A PARTNERED PLACE TOO (MESITA-2009). It used to
          be unpartnered-only, on the argument that a place that has bought
          needs the door and not the pitch. That was true when the ladder
          was two rungs and you were on one of them; with four it is the
          only place an operator can read what the rung ABOVE them carries,
          and the rung above is the one they might buy.

          ONLY WHEN THEY PAY. `PartnerBanner` hands a FREE place to
          `PartnerCard`, which draws the same grid WITH its buy doors —
          rendering this one too put the ladder on the screen twice.

          THE TEST IS THE RUNG AND NOT THE BADGE (MESITA-2014). They were
          the same boolean until the badge moved up to Mesita Ultra; reading
          `partnered` here would now give a place on Mesita Pro both grids,
          and this is the billing screen — the question it asks is whether
          this place PAYS.

          It carries no verb here: the Manage strip above it is the way
          out, and a second door would be the same exit twice. */}
      {place.plan !== "free" && <PlanComparison current={place.plan} />}
    </div>
  );
}
