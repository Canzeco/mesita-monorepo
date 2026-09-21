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
// ── SETUP STANDARD (MESITA-2034) ────────────────────────────────────────────
//
// One Group, plain heading (D3 — the "N of 5" and "At risk" facts move into
// the description, not a badge in the title). Each checklist row is
// badge-alone except the plan-rung row, which also carries "Open Plan" — the
// only row here with a verb, matching the whole product having exactly one
// door.
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { placePlanHref } from "@/lib/console-routes";
import { Group } from "@/components/shared/Group";
import { Rule } from "@/components/shared/Rule";
import { Badge } from "@/components/shared/Badges";
import { Notice } from "@/components/shared/Notice";
import { useMock } from "@/mock/MockStore";
import { partnerChecks, partnerStatus } from "@/lib/partner";
import { day } from "@/lib/format";
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
  const router = useRouter();
  const profile = world.profiles[place.id];
  const status = partnerStatus(place, profile);
  const checks = partnerChecks(place, profile);
  const openPlan = () => router.push(placePlanHref(place.id));

  const grantingSentence =
    GRANTING.length === 1
      ? `${grantingRungs()} carries the badge.`
      : `${grantingRungs()} each carry the badge.`;
  const ownRungSentence = place.partnered
    ? `Nothing here switches it — it follows the rung, and it goes with the subscription if this place drops below ${PLAN_LABEL[PARTNER_MIN_PLAN]}.`
    : `Nothing here switches it on — it arrives with the rung, the moment the rung changes. This place is on ${PLAN_LABEL[place.plan]}, so there is no badge.`;

  return (
    <div className="flex flex-col gap-4">
      <Notice
        show={Boolean(place.partnerLapsedAt && !status.badge)}
        tone="bad"
        icon={<Check className="h-4 w-4" aria-hidden />}
        title={`Badge removed ${place.partnerLapsedAt ? day(place.partnerLapsedAt) : ""}.`}
        note="The plan dropped below the rung that carries it. Verified stays; the badge comes back the day every row is green again."
        action={{ label: "Open Plan", onClick: openPlan }}
      />

      <Group
        title={status.badge ? "Partner" : "Becoming a Partner"}
        description={`${status.done} of ${checks.length} done. ${
          status.badge
            ? status.atRisk
              ? "A row below has gone red; the badge stays until the plan drops, but a guest who comes for what that row promised will not find it."
              : "Every row is green. A guest reading the map sees that Mesita stands behind this place."
            : "Complete the five and the badge appears on your page and on the map. Each row says where to do it."
        }`}
        footer={`${grantingSentence} ${ownRungSentence} The rung is on Plan.`}
      >
        {checks.map((c) =>
          c.key === "plan" ? (
            <Rule
              key={c.key}
              label={c.label}
              note={c.done ? undefined : c.fix}
              badge={
                c.done ? (
                  <Badge tone="on">Done</Badge>
                ) : (
                  <Badge tone={status.badge ? "bad" : "off"}>{status.badge ? "At risk" : "Not yet"}</Badge>
                )
              }
              control={{ kind: "button", label: "Open Plan", onClick: openPlan }}
            />
          ) : (
            <Rule
              key={c.key}
              label={c.label}
              note={c.done ? undefined : c.fix}
              control={{
                kind: "value",
                text: c.done ? (
                  <Badge tone="on">Done</Badge>
                ) : (
                  <Badge tone={status.badge ? "bad" : "off"}>{status.badge ? "At risk" : "Not yet"}</Badge>
                ),
              }}
            />
          ),
        )}
      </Group>
    </div>
  );
}
