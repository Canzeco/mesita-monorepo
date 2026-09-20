"use client";

// MESITA PARTNER — the badge, and nothing you can buy (MESITA-2012).
//
// Pato, looking at this pane with the four-rung ladder on it: *"this goes
// into plan, not mesita partner, different things."*
//
// ── WHAT LEFT ──────────────────────────────────────────────────────────────
//
// The renewal line, the Manage strip and the ladder are `PlanPane` now, at
// `/places/<id>/plan`. They arrived here in MESITA-2011, which made `partner`
// a product and handed it the Plan row's entire screen rather than writing
// the product one — so this file was a billing page wearing a product's
// header, and the first thing an operator met on a card badged `On` was four
// prices.
//
// ── WHAT IS LEFT IS ONE STRIP, AND THAT IS THE WHOLE PRODUCT ───────────────
//
// The badge is a fact about this place that a GUEST reads, which is exactly
// what the other nine rows are. What it does not have is a switch:
//
//   `partnered = isPartner(plan)` — Mesita Ultra alone since MESITA-2019,
//   which is why the sentence below derives the granting set instead of
//   saying "every paid rung": Mesita Pro pays and wears none.
//
// It is DERIVED. No operator, no admin and no support agent can grant it
// without moving the rung, which is why Settings' own states table prints
// *"Never set on its own"* beside it. A STATED ABSENCE IS A DESIGN, which
// `ProductPane`'s header has held since MESITA-1981 — and here the absent
// thing is the control, so saying why is the screen.
//
// ── IT SAYS ONLY WHAT THE HEADER CANNOT ────────────────────────────────────
//
// `ProductPane` draws the mark, the name, the state badge, the blurb (*"The
// badge on your page, and the rung that grants it…"*) and the card's note
// (*"On here. Mesita Pro carries the badge."*) directly above this. A first
// pass of this file opened with two boxes restating exactly that in a larger
// type size, which is the same fact twice — the thing `shared/Badges.tsx`
// opens by forbidding, and the reason MESITA-1997 cut the strip on the old
// partnership screen down to one line.
//
// So three facts are left, and none of them is up there: EVERY paid rung
// grants it, not only the one this place is on; nothing here can switch it;
// and the rung is changed on Plan. One strip, the same shape as
// `PartnerBanner`'s, because it is doing the same job — a sentence and the
// door it points at.
import Link from "next/link";
import { Check } from "lucide-react";
import { placePlanHref } from "@/lib/console-routes";
import { Section } from "@/components/shared/Section";
import { Badge } from "@/components/shared/Badges";
import { Rule, RULES_CARD } from "@/components/shared/Rule";
import { ErrorNote } from "@/components/ErrorNote";
import { useMock } from "@/mock/MockStore";
import { partnerChecks, partnerStatus } from "@/lib/partner";
import { day } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import {
  isPartner,
  PARTNER_MIN_PLAN,
  PLAN_LABEL,
  PLAN_LADDER,
  type MockPlace,
  type PlanTier,
} from "@/mock/types";

/** The rungs that carry the badge, derived rather than typed: `isPartner`
 *  read forwards, so a fifth rung in `PLAN_RANK` appears in the sentence below
 *  with nothing else edited — and so does the floor moving again, which it did
 *  the day after this file was written (MESITA-2014). */
const GRANTING: readonly PlanTier[] = PLAN_LADDER.filter(isPartner);

function grantingRungs(): string {
  const names = GRANTING.map((t) => PLAN_LABEL[t]);
  const last = names[names.length - 1];
  return names.length === 1
    ? last
    : `${names.slice(0, -1).join(", ")} and ${last}`;
}

export function PartnerPane({ place }: { place: MockPlace }) {
  const { world } = useMock();
  const profile = world.profiles[place.id];
  const status = partnerStatus(place, profile);
  const checks = partnerChecks(place, profile);

  return (
    <div className="flex flex-col gap-4">
      {/* THE CHECKLIST, AND THE METER OVER IT (MESITA-2017). Pato, 2026-09-20:
          Partner is "casi un producto" — a card in Setup with a list that ends
          in a badge. Five rows, "N of 5", so on a fresh place the second row
          of the menu reads as a goal rather than as a broken product. The
          rung stays the fifth row and stays bought on Plan; nothing here
          switches anything, which is the strip below's whole sentence. */}
      {place.partnerLapsedAt && !status.badge && (
        <ErrorNote
          className="mt-0"
          message={`Badge removed ${day(place.partnerLapsedAt)}.`}
          cause="The plan dropped below the rung that carries it. Verified stays; the badge comes back the day every row is green again."
          action={{ label: "Open Plan", href: placePlanHref(place.id) }}
        />
      )}
      <Section
        title={
          <span className="flex items-center gap-2">
            {status.badge ? "Partner" : "Becoming a Partner"}
            <Badge tone={status.badge ? "gold" : "off"}>{status.done} of {checks.length}</Badge>
            {status.atRisk && <Badge tone="bad">At risk</Badge>}
          </span>
        }
        description={
          status.badge
            ? status.atRisk
              ? "You hold the badge. A row below has gone red; the badge stays until the plan drops, but a guest who comes for what that row promised will not find it."
              : "Every row is green. A guest reading the map sees that Mesita stands behind this place."
            : "Complete the five and the badge appears on your page and on the map. Each row says where to do it."
        }
      >
        <div className={RULES_CARD}>
          {checks.map((c) => (
            <Rule
              key={c.key}
              label={c.label}
              note={c.done ? undefined : c.fix}
              value={
                c.done ? (
                  <Badge tone="on">
                    <Check className="h-3 w-3" aria-hidden /> Done
                  </Badge>
                ) : (
                  <Badge tone={status.badge ? "bad" : "off"}>{status.badge ? "At risk" : "Not yet"}</Badge>
                )
              }
            />
          ))}
        </div>
      </Section>
    <div className="border-border bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3">
      <p className="text-muted-foreground min-w-0 grow basis-72 text-[13px] leading-snug">
        {/* THE SET, NOT THIS PLACE'S RUNG. The note above names the one it is
            on; what an operator is actually asking here is which of the four
            would keep the badge, and on Free, which would earn it.
            THE VERB COUNTS THE SET (MESITA-2021). It read "<rungs> each carry
            the badge" while the granting set was two rungs wide; MESITA-2019
            left one rung in it and the sentence on the screen became "Mesita
            Ultra each carry the badge." `GRANTING` is already derived, so the
            verb is derived from its length rather than typed for whichever
            size the set happens to be this month. */}
        <span className="text-foreground font-medium">
          {GRANTING.length === 1
            ? `${grantingRungs()} carries the badge.`
            : `${grantingRungs()} each carry the badge.`}
        </span>{" "}
        {/* AND THE RUNG THIS PLACE IS ACTUALLY ON (MESITA-2014). The "off"
            sentence used to name Free, because Free was the only rung
            without the badge. Mesita Pro is another one, and telling a place
            that pays every month that it is on Free is the plainest lie this
            strip could tell. */}
        {place.partnered
          ? `Nothing on this screen switches it — it follows the rung, and it goes with the subscription if this place drops below ${PLAN_LABEL[PARTNER_MIN_PLAN]}.`
          : `Nothing on this screen switches it on — it arrives with the rung, the moment the rung changes. This place is on ${PLAN_LABEL[place.plan]}, so there is no badge.`}{" "}
        The rung is on Plan.
      </p>
      {/* THE DOOR, AND THE ONLY ONE. There is no verb on this screen because
          there is no verb on this product: the badge is bought as a rung or
          not at all. */}
      <Link href={placePlanHref(place.id)} className={GHOST_PILL_BUTTON_CLASS}>
        Plan
      </Link>
    </div>
    </div>
  );
}
