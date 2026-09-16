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
// ── TWO TABLES, AND WHY IT CANNOT BE ONE ───────────────────────────────────
//
// Rewards add. The page therefore owes two facts, and they want different
// columns:
//
//   the LADDER — what every rung pays          → columns are STRATEGIES
//   the STACK  — what those rungs add up to    → columns are STEPS
//
// One table carries one set of columns, so a single table drops either the
// strategy comparison or the climb. Hence two cards, ladder first: you read the
// price list, then you read the bill (MESITA-1923; the operator's twin of the
// ladder is web-admin `rewards-config/TiersClient.tsx`).
//
// THE STACK IS THE POINT. Nine rungs with no running total is the screen that
// gets this decision made wrong: an owner who sets a program without ever
// seeing 90% is an owner who meets it on a ticket. And a ceiling shown without
// its CAP misleads in the other direction, so the cap is a control here, not a
// footnote — at MX$500 that 90% guest costs MX$450, whatever they ordered.
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
  CAPS_MXN,
  CLASS_KEYS,
  CLASS_LABEL,
  DEFAULT_CAP,
  LADDER,
  RUNGS,
  RUNG_LABEL,
  STEPS,
  capCostCents,
  stack,
  type CapMxn,
  type Rung,
} from "@/lib/rewards";
import {
  CTA_BUTTON_CLASS,
  FOCUS_RING_CLASS,
  GHOST_PILL_BUTTON_CLASS,
  INFO_BOX_CLASS,
  STATES_COL_CELL,
  STATES_COL_HEAD,
  TINY_LABEL_CLASS,
  TOUCH_TARGET_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** The scrollport both tables ride. The padding sits on the SCROLLER, not the
 *  table, so the swipe reaches the edge of the glass on a phone and the first
 *  label is not flush against it. Mirrors the admin's own solution. */
const SCROLLPORT = "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0";
const HEAD_CELL =
  "text-muted-foreground border-border border-b px-3 py-2 text-[10px] font-semibold tracking-[0.14em] uppercase";
/** Whole pesos with a thousands separator. `moneyShort` renders MX$1,000 as
 *  "$1.0k", which is the wrong shape for a cap an owner is choosing between,
 *  and `money` adds two decimals no rate ever needs. */
function pesos(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

const NUM = "font-display text-base font-semibold tracking-tight tabular-nums";

export function RewardsView() {
  const place = useHeldPlace();
  const { scenario } = useMock();

  // SAVED is what this place is running; the other two are the draft. The
  // seed is compared during render rather than synced in an effect — setState
  // in useEffect is a lint error on Next 16, and an effect would also paint one
  // frame of the previous place's program.
  const seed = `${place.id}:${place.visitRewards}`;
  const [seeded, setSeeded] = useState(seed);
  const initial: Rung = place.visitRewards ? "aggressive" : "off";
  const [saved, setSaved] = useState<{ rung: Rung; cap: CapMxn }>({
    rung: initial,
    cap: DEFAULT_CAP,
  });
  const [rung, setRung] = useState<Rung>(initial);
  const [cap, setCap] = useState<CapMxn>(DEFAULT_CAP);
  const [justSaved, setJustSaved] = useState(false);
  if (seeded !== seed) {
    setSeeded(seed);
    setSaved({ rung: initial, cap: DEFAULT_CAP });
    setRung(initial);
    setCap(DEFAULT_CAP);
    setJustSaved(false);
  }

  const dirty = rung !== saved.rung || cap !== saved.cap;
  const off = rung === "off";

  const visits = listFor(
    VISITS.filter((v) => v.placeId === place.id),
    scenario,
  );
  const given = visits.reduce((n, v) => n + v.rewardCents, 0);
  const rewarded = visits.filter((v) => v.rewardCents > 0).length;

  function save() {
    setSaved({ rung, cap });
    setJustSaved(true);
    // Plain timeout in the handler, never an effect. React drops a setState on
    // an unmounted component, so this needs no teardown.
    setTimeout(() => setJustSaved(false), 4000);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* TWO tiles, not four. The ceiling used to sit here and it is the last
          cell of the stack table now: a tile that repeats a number six inches
          below it is the noise that stops people reading either. */}
      <Tiles
        tiles={[
          {
            label: "Strategy",
            value: RUNG_LABEL[saved.rung],
            hint: dirty ? "Unsaved change below" : undefined,
          },
          {
            label: "Given back",
            value: visits.length ? money(given) : null,
            hint: `Across ${rewarded} rewarded visit${rewarded === 1 ? "" : "s"} on the Visits view`,
          },
        ]}
      />

      <Section
        title="What this place pays, rung by rung"
        description="Nine rewards, three groups. Pick a column and every rung follows it — the rates are Mesita's, and a place chooses which column it runs."
      >
        <div className={SCROLLPORT}>
          <table className="w-full min-w-[540px] border-collapse">
            <caption className="sr-only">
              What each reward pays, at each strategy. Base is a rate; every
              other row adds to it.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className={cn(HEAD_CELL, STATES_COL_HEAD, "text-left")}
                >
                  Reward
                </th>
                {RUNGS.map((r) => (
                  <th key={r} scope="col" className={cn(HEAD_CELL, "text-right")}>
                    {/* The HEADER is the picker. A place runs one column, so
                        choosing the column IS choosing the program. */}
                    <button
                      type="button"
                      aria-pressed={rung === r}
                      onClick={() => setRung(r)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase transition",
                        FOCUS_RING_CLASS,
                        TOUCH_TARGET_CLASS,
                        rung === r
                          ? "border-foreground text-foreground"
                          : "border-transparent hover:border-foreground/30",
                      )}
                    >
                      {RUNG_LABEL[r]}
                      {rung === r && (
                        <Check className="ml-1 inline h-3 w-3" aria-hidden />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LADDER.map((row) =>
                "band" in row ? (
                  <tr key={row.band}>
                    <td colSpan={1 + RUNGS.length} className="px-3 pt-4 pb-1">
                      {/* The LABEL is sticky, not the cell. A colSpan cell is
                          as wide as the table, so pinning it pins nothing;
                          swipe right and the band headings slid away, leaving
                          three unexplained blank rows behind the rates. */}
                      <span
                        className={cn(
                          TINY_LABEL_CLASS,
                          "bg-card sticky left-0 inline-block",
                        )}
                      >
                        {row.band}
                      </span>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.key} className="border-border border-t">
                    <th
                      scope="row"
                      className={cn(
                        STATES_COL_CELL,
                        "px-3 py-2.5 text-left font-medium",
                      )}
                    >
                      <span className="text-sm">{row.name}</span>
                      <span className="text-muted-foreground block text-[11.5px] leading-snug font-normal">
                        {row.hint}
                      </span>
                    </th>
                    {RUNGS.map((r) => {
                      const on = r === rung;
                      // Off is a column, not a mode: its cells are the same em
                      // dash Bronze already wears, so the table never dims and
                      // the page never grows a second layout.
                      const dash = r === "off" || row.pinned === true;
                      return (
                        <td
                          key={r}
                          className={cn(
                            "px-3 py-2.5 text-right",
                            NUM,
                            on && "bg-foreground/[0.03]",
                            dash && "text-muted-foreground font-normal",
                          )}
                        >
                          {r === "off" || row.pinned
                            ? "—"
                            : `${row.signed ? "+" : ""}${row.rate(r)}%`}
                        </td>
                      );
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="What that stacks to"
        description="Left to right is the addition: each column adds one more reward to the one before it. The peso under every total is the most it can cost, at this cap."
      >
        {off ? (
          /* The empty state is a feature. Nine dashes and a grid of 0% is not
             one — it says the page is broken rather than that the place has
             chosen something. */
          <p className={INFO_BOX_CLASS}>
            Nothing is given back here. Guests still find this place, review it
            and book a table; they just pay the whole bill. Pick a column above
            to start.
          </p>
        ) : (
          <div className={SCROLLPORT}>
            <table className="w-full min-w-[620px] border-collapse">
              <caption className="sr-only">
                What a guest of each class pays, as they earn each reward. Every
                figure is a running total.
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className={cn(HEAD_CELL, STATES_COL_HEAD, "text-left")}
                  >
                    Class
                  </th>
                  {STEPS.map((s) => (
                    <th
                      key={s.key}
                      scope="col"
                      className={cn(HEAD_CELL, "text-right")}
                    >
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CLASS_KEYS.map((c) => {
                  const row = stack(rung, c);
                  return (
                    <tr key={c} className="border-border border-t">
                      <th
                        scope="row"
                        className={cn(
                          STATES_COL_CELL,
                          "px-3 py-2.5 text-left text-sm font-medium",
                        )}
                      >
                        {CLASS_LABEL[c]}
                      </th>
                      {row.map((total, i) => {
                        const peak =
                          c === "diamond" && i === row.length - 1;
                        return (
                          <td
                            key={STEPS[i].key}
                            className="px-3 py-2.5 text-right"
                          >
                            <span
                              className={cn(NUM, peak && "text-[color:var(--brand-pink-text)]")}
                            >
                              {total}%
                            </span>
                            <span className="text-muted-foreground block text-[11px] font-semibold tabular-nums">
                              {pesos(capCostCents(total, cap) / 100)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* THE CAP IS A CONTROL, not a footnote. It is the only parameter
            that bounds the ceiling above, and a place that cannot move it reads
            90% as a catastrophe and turns the whole product off. It is also the
            only control here that means nothing while the program is Off: a cap
            bounds a discount, and there is no discount to bound. */}
        {!off && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={TINY_LABEL_CLASS}>Cap</span>
              {CAPS_MXN.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cap === c}
                  onClick={() => setCap(c)}
                  className={cn(
                    GHOST_PILL_BUTTON_CLASS,
                    cap === c &&
                      "border-foreground hover:border-foreground text-foreground",
                  )}
                >
                  {pesos(c)}
                  {cap === c && (
                    <Check className="h-3 w-3 shrink-0" aria-hidden />
                  )}
                </button>
              ))}
            </div>
          <p className={INFO_BOX_CLASS}>
            A percentage is not a peso. Every rate above applies to the first{" "}
            {pesos(cap)} of the bill, so a guest who earns every rung costs you{" "}
            {pesos(capCostCents(stack(rung, "diamond")[4], cap) / 100)}, whatever
            they ordered. That is what keeps a ceiling from being a night.
          </p>
          </>
        )}
      </Section>

      {/* The commit bar exists only when something changed. A permanent Save
          that looks identical before and after a click cannot answer the one
          question an owner asks on a money screen: did that take? */}
      {dirty && (
        <div className="border-border bg-card shadow-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {rung !== saved.rung &&
                `${RUNG_LABEL[rung]}, from ${RUNG_LABEL[saved.rung]}`}
              {rung !== saved.rung && cap !== saved.cap && " · "}
              {cap !== saved.cap &&
                `Cap ${pesos(cap)}, from ${pesos(saved.cap)}`}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[12px]">
              Applies to the next bill closed here. Nothing retroactive, ever.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRung(saved.rung);
                setCap(saved.cap);
              }}
              className={GHOST_PILL_BUTTON_CLASS}
            >
              Cancel
            </button>
            <button type="button" onClick={save} className={CTA_BUTTON_CLASS}>
              Save
            </button>
          </div>
        </div>
      )}
      {!dirty && justSaved && (
        <p className="text-muted-foreground flex items-center gap-2 px-1 text-[12px]">
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Saved. The next bill closed here runs {RUNG_LABEL[saved.rung]},
          capped at the first {pesos(saved.cap)}.
        </p>
      )}

      <SoonStrip title="Rewards on orders is not a thing, and will not be">
        A reward is earned by turning up. An order is prepaid and has no table,
        so there is nothing to reward and nobody standing there to see it
        happen. Use Credits for the prepaid case.
      </SoonStrip>
    </div>
  );
}
