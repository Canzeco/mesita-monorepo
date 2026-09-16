"use client";

// Rewards — what a place GIVES BACK, priced by the place.
//
// IT IS A MONEY PRODUCT, and that is why it sits beside Payments and Credits
// rather than beside Visits. Visits is the container guests arrive through;
// Rewards is the dial. The two were folded into one screen once and the dial
// ended up living in the container's settings, where nobody could find it.
//
// REWARDS ARE VISIT-ONLY. A reward is earned by showing up and closing a bill,
// never by placing an order — an order is prepaid and has no table to reward.
//
// ── FOUR STRATEGIES, NOT ONE ───────────────────────────────────────────────
//
// This page shipped as ONE dial printing ONE rate, which described a product
// Mesita stopped selling at v12. Four reasons are priced — class, welcome,
// Instagram story, Google review — each gets its own strategy here, and the
// arithmetic between them is ADDITION, not choice. `lib/rewards.ts` holds the
// ladders and the reasoning; this file draws them.
//
// THE RUNNING TOTAL IS THE POINT. Four independent controls hide the only
// number that matters — what they come to on one bill — and an owner who sets
// four dials without ever seeing 85% is an owner who will see it for the first
// time on a ticket. So the stack is rendered under the dials, at its floor and
// at its ceiling, and it moves while you pick.
import { useState } from "react";
import { Check } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Tiles } from "@/components/shared/Tiles";
import { SoonStrip } from "@/components/shared/SoonStrip";
import { VISITS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { money } from "@/lib/format";
import {
  ALL_OFF,
  BONUS,
  CLASS_BASE,
  CLASS_LABEL,
  DEFAULT_PICKS,
  REASONS,
  RUNGS,
  RUNG_LABEL,
  ceiling,
  countOn,
  stack,
  type Picks,
  type ReasonKey,
  type Rung,
} from "@/lib/rewards";
import {
  CTA_BUTTON_CLASS,
  FOCUS_RING_CLASS,
  INFO_BOX_CLASS,
  SCOPE_CARD_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** What one rung prints on its pill. The class row pays a LADDER, so it shows
 *  its span; a bonus pays one number and wears a `+`, because the plus is the
 *  whole argument — these are not alternatives to the base, they land on top
 *  of it. */
function face(key: ReasonKey, rung: Rung): string {
  if (rung === "off") return "—";
  if (key !== "class") return `+${BONUS[key][rung]}%`;
  return `${CLASS_BASE[rung].bronze}–${CLASS_BASE[rung].diamond}%`;
}

const ROW_CLASS =
  "flex min-w-0 flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4";

export function RewardsView() {
  const place = useHeldPlace();
  const { scenario } = useMock();

  // The picks are seeded from the place's switch and RE-SEEDED when it moves.
  // Compared during render rather than synced in an effect: `setState` inside
  // `useEffect` is a lint ERROR on Next 16, and the effect would also paint one
  // frame of the old place's dials. The old page seeded once and never looked
  // again, so flipping Rewards off in the panel left the rate sitting there.
  const seed = `${place.id}:${place.visitRewards}`;
  const [seeded, setSeeded] = useState(seed);
  const [picks, setPicks] = useState<Picks>(
    place.visitRewards ? DEFAULT_PICKS : ALL_OFF,
  );
  if (seeded !== seed) {
    setSeeded(seed);
    setPicks(place.visitRewards ? DEFAULT_PICKS : ALL_OFF);
  }

  const visits = listFor(
    VISITS.filter((v) => v.placeId === place.id),
    scenario,
  );
  const given = visits.reduce((n, v) => n + v.rewardCents, 0);
  const rewarded = visits.filter((v) => v.rewardCents > 0).length;
  const on = countOn(picks);

  // The floor and the ceiling of what is picked right now: a regular who did
  // nothing but turn up, and the guest who earned every rung there is.
  const floor = stack(picks, "bronze", {
    firstVisit: false,
    story: false,
    google: false,
  });
  const peak = stack(picks, "diamond", {
    firstVisit: true,
    story: true,
    google: true,
  });

  return (
    <div className="flex flex-col gap-4">
      <Tiles
        tiles={[
          { label: "Rewards", value: on > 0 ? "On" : "Off" },
          {
            label: "Strategies on",
            value: `${on} of 4`,
            hint: "Class, welcome, story, review",
          },
          {
            label: "Most a guest can reach",
            value: `${ceiling(picks)}%`,
            hint: "Diamond, first visit, story and review",
          },
          {
            label: "Given back",
            value: visits.length ? money(given) : null,
            hint: `Across ${rewarded} rewarded visit${rewarded === 1 ? "" : "s"} on the Visits view`,
          },
        ]}
      />

      <Section
        title="What this place gives back, and for what"
        description="Four strategies, one per reason. They are not alternatives: every rung a guest earns is ADDED to the same bill, so the dials move one number together."
        lane
      >
        <div className={SCOPE_CARD_CLASS}>
          {REASONS.map((r) => (
            <div key={r.key} className={ROW_CLASS}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
                  {r.earns}
                </p>
              </div>
              {/* A grid on a phone so three pills split the width evenly
                  instead of overflowing it, their own size from `sm` up. */}
              <div
                className="grid w-full shrink-0 grid-cols-3 gap-2 sm:w-auto"
                role="group"
                aria-label={`${r.name} strategy`}
              >
                {RUNGS.map((rung) => {
                  const picked = picks[r.key] === rung;
                  return (
                    <button
                      key={rung}
                      type="button"
                      aria-pressed={picked}
                      aria-label={`${r.name}: ${RUNG_LABEL[rung]}`}
                      onClick={() =>
                        setPicks((p) => ({ ...p, [r.key]: rung }))
                      }
                      className={cn(
                        "rounded-xl border px-2.5 py-2 text-left transition sm:w-28",
                        FOCUS_RING_CLASS,
                        picked
                          ? "border-foreground bg-foreground/[0.03]"
                          : "border-border hover:border-foreground/30",
                      )}
                    >
                      <span className="flex items-center justify-between gap-1">
                        {/* NOT `TINY_LABEL_CLASS`: uppercase at 0.14em tracking
                            makes "Conservative" wider than its own pill. */}
                        <span className="text-muted-foreground truncate text-[10px] font-semibold sm:text-[11px]">
                          {RUNG_LABEL[rung]}
                        </span>
                        {picked && (
                          <Check className="h-3 w-3 shrink-0" aria-hidden />
                        )}
                      </span>
                      {/* `whitespace-nowrap`, or a phone breaks "10–25%" across
                          two lines and the three pills stop being one row. */}
                      <span className="font-display mt-0.5 block text-base font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-lg">
                        {face(r.key, rung)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* THE STACK. Same arithmetic the bill engine runs, on what is picked
            above — the floor of the program and its ceiling, side by side,
            because the gap between them is the thing four dials make invisible. */}
        <div className="border-border grid grid-cols-1 gap-3 rounded-2xl border border-dashed p-4 sm:grid-cols-2">
          <StackCase
            label="A Bronze regular, fourth visit, nothing earned"
            terms={floor.terms}
            total={floor.total}
          />
          <StackCase
            label={`A ${CLASS_LABEL.diamond} guest's first visit, story posted, review left`}
            terms={peak.terms}
            total={peak.total}
          />
        </div>

        <button type="button" className={cn(CTA_BUTTON_CLASS, "self-start")}>
          Save the strategies
        </button>

        <p className={INFO_BOX_CLASS}>
          A percentage is not a peso. Every rate above applies to the first
          stretch of the bill only — the place&rsquo;s cap — which is what keeps
          an 85% ceiling from being an 85% night. The cap is not on this page
          yet, and setting four dials without it is the one thing this screen
          cannot let an owner do. There is a fifth rung the engine already
          prices, a Mesita review, that no guest surface lists; it gets no dial
          here until it does.
        </p>
      </Section>

      <SoonStrip title="Rewards on orders is not a thing, and will not be">
        A reward is earned by turning up. An order is prepaid and has no table,
        so there is nothing to reward and nobody standing there to see it
        happen. Use Credits for the prepaid case.
      </SoonStrip>
    </div>
  );
}

/** One worked bill: the rungs that fired, then what they come to. The terms are
 *  printed as a SUM rather than summarised, because "50 + 10 + 10 + 15" is the
 *  sentence an owner needs to have read once. */
function StackCase({
  label,
  terms,
  total,
}: {
  label: string;
  terms: { key: string; name: string; rate: number }[];
  total: number;
}) {
  return (
    <div className="min-w-0">
      <p className={TINY_LABEL_CLASS}>{label}</p>
      <p className="font-display mt-1 text-3xl font-semibold tracking-tight tabular-nums">
        {total}%
      </p>
      <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
        {terms.length === 0
          ? "Nothing is on — this guest pays the full bill."
          : terms.map((t, i) => (
              <span key={t.key}>
                {i > 0 && " + "}
                <span className="tabular-nums">{t.rate}%</span> {t.name}
              </span>
            ))}
      </p>
    </div>
  );
}
