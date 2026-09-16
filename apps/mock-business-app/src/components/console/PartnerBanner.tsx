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
// AND THE STRIP DOES NOT REPEAT THE HEADING. `PlaceHeading` renders
// `PlaceFacts` on every place view, so a partnered Products screen already
// carries a gold **Partner** badge top right. The shipped `web-business`
// strip opens with a green check, the words "Mesita Partner" and an "Active"
// chip — the same one fact, twice, a hundred pixels apart, in two colours,
// against `shared/Badges.tsx`'s opening rule.
//
// So this strip leads with what the heading CANNOT say: the date. The heading
// answers what the place IS; the strip answers what the membership is DOING.
// The chip comes back only when the state is not plain active — see
// `membershipChip` — because then it is new information rather than an echo.
import {
  ManageMembership,
  membershipChip,
  membershipLine,
  PartnerCard,
} from "@/components/console/PartnerCard";
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
