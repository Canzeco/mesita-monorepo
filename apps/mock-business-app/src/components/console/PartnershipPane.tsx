"use client";

// MESITA PARTNERSHIP, OPENED — on either surface (MESITA-1986).
//
// It is a row on both indexes because it is a row in the list, and a row that
// refuses one of the two surfaces breaks the symmetry it is part of. What
// changes is what it has to say:
//
//   products   what you pay for, when it renews, and the gate itself
//   activity   nothing yet, said plainly
//
// THE PARTNERSHIP HAS NO LOG. Its events — renewed, past due, cancelled — are
// `SUBSCRIPTION` rows in the place-wide log, which is the Activity index's own
// default pane. Inventing a second timeline here would be one story told twice
// and eventually told differently.
import { membershipLine } from "@/components/console/PartnerCard";
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { Badge } from "@/components/shared/Badges";
import { type MockPlace, PLAN_LABEL } from "@/mock/types";
import type { PlaceHalf } from "@/lib/product-routes";
import { PageHeader } from "@/components/console/PageHeader";

export function PartnershipPane({
  place,
  half = "products",
}: {
  place: MockPlace;
  half?: PlaceHalf;
}) {
  const line = membershipLine(place);

  return (
    <div className="flex flex-col gap-4">
      {/* THE SHARED HEADER (MESITA-2008). This pane used to hand-copy
          `ProductPane`'s markup into its own file, and had already drifted:
          two badges where the product panes draw one. Both read `PageHeader`
          now, and the two badges are a `badges` slot rather than a fork. */}
      <PageHeader
        mark={"\u{1F91D}"}
        title="Plan"
        badges={
          <>
            {/* BOTH FACTS, because they are two (MESITA-1997): the rung is
                what they bought, the badge is what it granted. */}
            <Badge tone={place.partnered ? "gold" : "off"}>
              {PLAN_LABEL[place.plan]}
            </Badge>
            {place.partnered && <Badge tone="gold">Partner</Badge>}
          </>
        }
        blurb={
          <>
            <span className="text-foreground font-medium">{line.lead}</span>{" "}
            {line.rest}
          </>
        }
      />

      {half === "products" ? (
        /* The heading above already states the rung, the badge and what the
           billing is doing, so a partnered place gets the DOOR and nothing
           else; a Free place gets the ladder, which the heading cannot be.
           Before MESITA-1997 the two disagreed enough to both be worth
           printing — "Mesita Partnership / Partner" over "Membership /
           Renews …" — and once both named the rung they were one fact twice,
           which `shared/Badges.tsx` opens by forbidding. */
        <PartnerBanner place={place} />
      ) : (
        <p className="text-muted-foreground text-[13px] leading-snug">
          The partnership keeps no log of its own. Renewals, a card that failed
          and a cancellation are on the invoices Stripe sends, and on the card
          above when they change what you are on.
        </p>
      )}
    </div>
  );
}
