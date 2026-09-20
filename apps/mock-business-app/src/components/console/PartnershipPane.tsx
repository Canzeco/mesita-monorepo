"use client";

// MESITA PARTNER, OPENED (MESITA-1986, and a product since MESITA-2011).
//
// WHAT YOU PAY FOR, WHEN IT RENEWS, AND THE LADDER. That is the whole screen,
// and it is now the Setup half of the `partner` product rather than the Plan
// row's own pane.
//
// ── IT LOST ITS ACTIVITY SURFACE, NOT ITS ARGUMENT (MESITA-2011) ───────────
//
// This pane used to answer both addresses, on the symmetry rule: a row in the
// list may not refuse one of the two surfaces. Its Activity half said, in
// prose, that there was nothing to say — the partnership's events are
// `SUBSCRIPTION` rows and Stripe's own invoices, and a second timeline here
// would be one story told twice and eventually told differently.
//
// A product may have ONE half (`PRODUCT_HALVES`), which a sentinel row could
// not, so the address goes instead of the sentence staying. Prepaid Credits
// and Online Reviews are the same shape from the other side: log only, and no
// Setup address at all.
//
// ── AND IT DRAWS NO HEADER INSIDE A PRODUCT PANE ──────────────────────────
//
// `header={false}` is what `ProductPane` passes: that component heads every
// product with the card's mark, name, state badge and blurb, and this pane
// drew its own only because Plan was not a product. The rung and the badge it
// printed as two badges are the card's state badge and its note now — one
// fact, one place, which is the rule `shared/Badges.tsx` opens with.
import { membershipLine } from "@/components/console/PartnerCard";
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { Badge } from "@/components/shared/Badges";
import { type MockPlace, PLAN_LABEL } from "@/mock/types";
import { PRODUCT_LABEL } from "@/lib/product-keys";
import { PageHeader } from "@/components/console/PageHeader";
import { PlanComparison } from "@/components/console/PlanComparison";
import { Section } from "@/components/shared/Section";
import { Rule, RULES_CARD } from "@/components/shared/Rule";
import { ErrorNote } from "@/components/ErrorNote";
import { useMock } from "@/mock/MockStore";
import { partnerStatus } from "@/lib/partner";
import { day } from "@/lib/format";
import { Check } from "lucide-react";

export function PartnershipPane({
  place,
  header = true,
}: {
  place: MockPlace;
  /** FALSE INSIDE `ProductPane`, which has already drawn one. It defaults to
   *  true so the pane stays readable on its own the day anything else mounts
   *  it. */
  header?: boolean;
}) {
  const line = membershipLine(place);
  const { world } = useMock();
  const status = partnerStatus(place, world.profiles[place.id]);
  const checks = status.failing.length === 0 ? [] : status.failing;

  return (
    <div className="flex flex-col gap-4">
      {header && (
        /* THE SHARED HEADER (MESITA-2008). This pane used to hand-copy
           `ProductPane`'s markup into its own file, and had already drifted:
           two badges where the product panes draw one. Both read `PageHeader`
           now, and the two badges are a `badges` slot rather than a fork. */
        <PageHeader
          mark={"\u{1F91D}"}
          title={PRODUCT_LABEL.partner}
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
      )}

      {/* WHAT THE BILLING IS DOING, WHEREVER THE HEADER WENT (MESITA-2011).
          Inside a product pane the card's own note says which rung carries the
          badge, and that is the fact an operator needs from the grid; it
          cannot carry the DATE, which is the one thing only this screen has.
          So the line prints here when the header that used to hold it is not
          drawn, rather than being a fact the move quietly dropped. */}
      {!header && (
        <p className="text-muted-foreground text-[13px] leading-snug">
          <span className="text-foreground font-medium">{line.lead}</span>{" "}
          {line.rest}
        </p>
      )}

      {/* A partnered place gets the DOOR and the ladder above it; a Free place
          gets `PartnerCard`'s ladder, which carries the buy doors. Before
          MESITA-1997 the heading and the banner disagreed enough to both be
          worth printing — "Mesita Partnership / Partner" over "Membership /
          Renews …" — and once both named the rung they were one fact twice,
          which `shared/Badges.tsx` opens by forbidding. */}
      {/* THE CHECKLIST, AND THE METER OVER IT (MESITA-2017). Pato: Partner is
          "casi un producto" — a card in Setup with a list that ends in a
          badge. Five rows, "N of 5", so the card reads as a goal on a fresh
          place rather than as a broken product two clicks from the top. */}
      {place.partnerLapsedAt && !status.badge && (
        <ErrorNote
          className="mt-0"
          message={`Badge removed ${day(place.partnerLapsedAt)}.`}
          cause="The plan lapsed. Verified stays; the badge comes back the day the checklist is green again."
          action={{ label: "Choose a plan", href: "#plans" }}
        />
      )}
      <Section
        title={
          <span className="flex items-center gap-2">
            {status.badge ? "Partner" : "Becoming a Partner"}
            <Badge tone={status.badge ? "gold" : "off"}>{status.done} of 5</Badge>
            {status.atRisk && <Badge tone="bad">At risk</Badge>}
          </span>
        }
        description={
          status.badge
            ? status.atRisk
              ? "You hold the badge. A row below has gone red; the badge stays until the plan lapses, but a guest who comes for what that row promised will not find it."
              : "Every row is green. A guest reading the map sees that Mesita stands behind this place."
            : "Complete the five and the badge appears on your page and on the map. Each row says where to do it."
        }
      >
        <div className={RULES_CARD}>
          {["verified", "profile", "rewards", "payments", "plan"].map((key) => {
            const failing = checks.find((c) => c.key === key);
            const label = { verified: "Verified", profile: "Profile complete", rewards: "Visit Rewards on", payments: "Online Payments on", plan: "A paid plan" }[key as "verified"];
            return (
              <Rule
                key={key}
                label={label}
                note={failing ? failing.fix : undefined}
                value={
                  failing ? (
                    <Badge tone={status.badge ? "bad" : "off"}>{status.badge ? "At risk" : "Not yet"}</Badge>
                  ) : (
                    <Badge tone="on">
                      <Check className="h-3 w-3" aria-hidden /> Done
                    </Badge>
                  )
                }
              />
            );
          })}
        </div>
      </Section>
      <div id="plans" />
      <PartnerBanner place={place} />
      {/* THE LADDER, FOR A PARTNERED PLACE TOO (MESITA-2009). It used to
          be unpartnered-only, on the argument that a place that has bought
          needs the door and not the pitch. That was true when the ladder
          was two rungs and you were on one of them; with four it is the
          only place an operator can read what the rung ABOVE them carries,
          and the rung above is the one they might buy.

          ONLY WHEN PARTNERED. `PartnerBanner` hands an unpartnered place
          to `PartnerCard`, which draws the same grid WITH its buy doors —
          rendering this one too put the ladder on the screen twice.

          It carries no verb here: the Manage strip above it is the way
          out, and a second door would be the same exit twice. */}
      {place.partnered && <PlanComparison current={place.plan} />}
    </div>
  );
}
