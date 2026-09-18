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
import type { MockPlace } from "@/mock/types";
import type { PlaceHalf } from "@/lib/product-routes";
import { SCOPE_CHIP_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

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
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            SCOPE_CHIP_CLASS,
            "bg-muted text-foreground flex shrink-0 items-center justify-center",
          )}
        >
          <span className="text-[22px] leading-none">{"\u{1F91D}"}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Mesita Partnership
            </h2>
            <Badge tone={place.partnered ? "gold" : "off"}>
              {place.partnered ? "Partner" : "Off"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
            <span className="text-foreground font-medium">{line.lead}</span>{" "}
            {line.rest}
          </p>
        </div>
      </div>

      {half === "products" ? (
        <PartnerBanner place={place} />
      ) : (
        <p className="text-muted-foreground text-[13px] leading-snug">
          The partnership keeps no log of its own. Renewals, a card that failed
          and a cancellation are Subscriptions rows in this place&apos;s whole
          log, one screen back.
        </p>
      )}
    </div>
  );
}
