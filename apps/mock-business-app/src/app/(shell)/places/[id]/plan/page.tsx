"use client";

// `/places/<id>/plan` — the purchase, on its own address again (MESITA-2012).
//
// A STATIC SEGMENT BESIDE `[view]`, which is how `products`, `activity` and
// the rest of `PLACE_PAGES` are served: Next resolves the folder before the
// dynamic one, so `PlaceTabGate` never sees `plan` and does not have to admit
// a name that is not a `PlaceTab`.
//
// IT IS NOT IN `PLACE_PAGES` EITHER. That list is the Setup/Activity pair —
// `pagesForAccess` gates it and `placePageFromPathname` reads it — and Plan is
// neither half of anything. It is one screen, reached from one row, the way
// `/settings` is.
//
// NO FLAT TWIN. `/plan` is deliberately absent from `FLAT_ROUTES`: every name
// in that list resolves to a `PlaceTab` or a `PlacePage`, and Plan is neither,
// so a twin would produce a `PlaceTab` called "plan" that no matrix has heard
// of — a 404 three files from its cause, which is the trap
// `console-routes.ts` already documents for `/home`.
//
// A VIEWER SEES IT. Settings shows the person the money on the same argument
// (*"A VIEWER SEES THE PERSON AND THE MONEY, NOT THE PLACE"*), and the one
// control that spends any — `ManagePlan` — is owner-only on its own.
import { MembershipReturnNotice } from "@/components/console/MembershipReturnNotice";
import { PageHeader } from "@/components/console/PageHeader";
import { PlanPane } from "@/components/console/PlanPane";
import { membershipLine } from "@/components/console/PartnerCard";
import { NotHeld, useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { Badge } from "@/components/shared/Badges";
import { PLAN_LABEL } from "@/mock/types";

export default function PlanPage() {
  const place = useHeldPlaceOrNull();
  if (!place) return <NotHeld />;
  const line = membershipLine(place);

  return (
    <>
      {/* THE RUNG IS THE BADGE AND THE BILLING IS THE BLURB. Both facts used
          to be drawn by `PartnershipPane` itself, which is why that component
          had a `header` prop at all — it was a page pretending to be a pane.
          The Partner badge does NOT repeat here: it is the state badge on the
          Partner Badge product, one row up the menu, and two badges for one
          derived fact is what `shared/Badges.tsx` opens by forbidding. */}
      <PageHeader
        mark={"\u{1F4B3}"}
        title="Plan"
        badges={<Badge tone={place.partnered ? "gold" : "off"}>{PLAN_LABEL[place.plan]}</Badge>}
        blurb={
          <>
            <span className="text-foreground font-medium">{line.lead}</span>{" "}
            {line.rest}
          </>
        }
      />
      {/* THE RETURN FROM STRIPE LANDS HERE NOW, because this is where the
          checkout left from — `PlanModal` redirects to this address. It was
          on the Setup index while the ladder was. */}
      <MembershipReturnNotice />
      <PlanPane place={place} />
    </>
  );
}
