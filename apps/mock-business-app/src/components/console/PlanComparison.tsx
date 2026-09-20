"use client";

// THE RUNGS, SIDE BY SIDE (MESITA-2009).
//
// Pato, 2026-09-19: *"MAKE PLAN COMPARISSION."* and *"List the perks of what
// you can activate and shit."* It was four columns then; MESITA-2019 repacked
// the suite into three and this file did not change, because it renders
// `PLAN_LADDER` and counts nothing.
//
// ── WHAT THE PLAN SCREEN DID BEFORE ────────────────────────────────────────
//
// It stated the rung you are on and offered one row — "Change the rung, see
// the invoices, or update the card" — and never showed the other rungs at all.
// A place on Free could not read what Pro would give it without leaving the
// console, which is the one question a billing screen exists to answer.
//
// ── THE PERK LISTS ARE DERIVED, NOT TYPED ──────────────────────────────────
//
// Every column is built from `SPECS` in `lib/products.ts` — the same array
// that decides what a product's own card says about its floor. A hand-typed
// list here would be a second writer for that fact, and the two would disagree
// the first time a `minPlan` moved. Moving Visit Rewards up to Ultra in this
// issue was one character in that array and this screen followed it.
//
// ── CUMULATIVE, AND IT SAYS SO ─────────────────────────────────────────────
//
// A column that RE-PRINTS everything below it is four inventories side by
// side, and the differences — the only thing an operator is reading for — are
// buried in the repetition. A column that prints only its own additions with
// no other signal reads as though Pro LOSES what Start had.
//
// So each column above Free says "Everything in <the rung below>, plus:" and
// then lists only what it adds. `planAtLeast` is the same rank arithmetic the
// entitlement check uses, so the "adds" set cannot drift from what the rung
// actually grants.
//
// ── THE PITCH LEADS, THE PRODUCTS FOLLOW ───────────────────────────────────
//
// A column headed by a price and then nine product names is an inventory. An
// operator picking a rung is picking a way to RUN THE PLACE, so `PLAN_PITCH`
// goes directly under the price and the list is the evidence for it.
import { PRODUCT_MARK } from "@/lib/product-marks";
import { PRODUCT_LABEL } from "@/lib/product-keys";
import { SPECS } from "@/lib/products";
import {
  PLAN_LABEL,
  PLAN_LADDER,
  PLAN_PITCH,
  PLAN_PRICE_MXN,
  PLAN_RANK,
  planAtLeast,
  type PlanTier,
} from "@/mock/types";
import { cn } from "@/lib/utils";

/** MX$ with a thousands separator and no centavos — the mock prints money and
 *  never charges it. `es-MX` so the separator is the one an operator in Mexico
 *  reads, and `MX$0` on Free rather than a dash: a rung with no price line is
 *  a rung you cannot compare against the three beside it. */
export function planPrice(tier: PlanTier): string {
  return `MX$${PLAN_PRICE_MXN[tier].toLocaleString("es-MX")}`;
}

/** What this rung adds that the one below it did not carry.
 *
 *  A SOON PRODUCT IS NOT A PERK. `spec.soon` means there is no engine behind
 *  it yet, so listing it under a price is selling something that cannot be
 *  switched on — and the catalogue already has a door for those. */
export function addedBy(tier: PlanTier): typeof SPECS {
  return SPECS.filter((spec) => !spec.soon && spec.minPlan === tier);
}

export function PlanComparison({
  current,
  action,
}: {
  current: PlanTier;
  /** The verb for a rung, rendered last in its column so it sits under what it
   *  buys. `PartnerCard` passes the buy door for the rungs above the current
   *  one; the partnered face passes none, because its way out is the Manage
   *  strip above the grid and a second door would be the same exit twice. */
  action?: (tier: PlanTier) => React.ReactNode;
}) {
  return (
    <section aria-label="Plans">
      {/* ONE COLUMN PER RUNG ABOVE `sm`, STACKED ON A PHONE. Three 13px
          columns inside a console that already spends 252px on its menu leave
          ~320px each at 1280px, which is room a four-column grid did not have
          — "Online Reservations" used to wrap. Below `sm` they stack in ladder
          order, so the page reads as a ladder on a phone rather than as a grid
          that lost its shape. */}
      <ul className="grid gap-3 sm:grid-cols-3">
        {PLAN_LADDER.map((tier) => {
          const mine = tier === current;
          const below = PLAN_LADDER[PLAN_RANK[tier] - 1];
          const adds = addedBy(tier);
          return (
            <li
              key={tier}
              className={cn(
                "border-border bg-card flex flex-col gap-3 rounded-2xl border p-4",
                // THE RUNG YOU ARE ON IS RINGED, NOT FILLED. A filled column
                // in a row of four is the brightest object on the screen, and
                // the thing an operator came here to read is the OTHER three.
                mine && "ring-foreground ring-2",
              )}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-[15px] font-semibold tracking-tight">
                    {PLAN_LABEL[tier]}
                  </h2>
                  {mine && (
                    <span className="bg-foreground text-paper rounded-full px-2 py-0.5 text-[10px] font-semibold">
                      Your plan
                    </span>
                  )}
                </div>
                <p className="font-display mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                  {planPrice(tier)}
                  <span className="text-muted-foreground ml-1 text-[12px] font-medium tracking-normal">
                    {tier === "free" ? "forever" : "/ month"}
                  </span>
                </p>
                {/* + IVA, ONCE PER COLUMN AND QUIETLY. It is true of every
                    paid rung and an operator in Mexico assumes it; printing
                    it at price size would make tax the second thing read. */}
                {PLAN_PRICE_MXN[tier] > 0 && (
                  <p className="text-muted-foreground text-[11px]">+ IVA</p>
                )}
              </div>

              <p className="text-foreground text-[13px] leading-snug font-medium">
                {PLAN_PITCH[tier]}
              </p>

              <div className="border-border flex flex-col gap-2 border-t pt-3">
                {below && (
                  <p className="text-muted-foreground text-[12px] leading-snug">
                    Everything in{" "}
                    <span className="text-foreground font-medium">
                      {PLAN_LABEL[below]}
                    </span>
                    , plus:
                  </p>
                )}
                <ul className="flex flex-col gap-1.5">
                  {adds.map((spec) => (
                    <li
                      key={spec.key}
                      className="flex items-start gap-2 text-[13px] leading-snug"
                    >
                      <span
                        aria-hidden
                        className="w-[16px] shrink-0 text-center text-[12px] leading-[1.35]"
                      >
                        {PRODUCT_MARK[spec.key]}
                      </span>
                      <span className="min-w-0">{PRODUCT_LABEL[spec.key]}</span>
                    </li>
                  ))}
                </ul>
                {/* A RUNG THAT ADDS NOTHING STILL SAYS SO. There is none
                    today, and a column that silently ended after its pitch
                    would read as a list that failed to load rather than as a
                    rung whose products all moved. */}
                {adds.length === 0 && (
                  <p className="text-muted-foreground text-[12px] leading-snug">
                    Nothing new yet — this rung carries what the one below it
                    does.
                  </p>
                )}
              </div>

              {/* `mt-auto` PINS THE VERB TO THE BOTTOM of every column, so four
                  columns with different-length lists still line their buttons
                  up. A row of buttons at four heights reads as four cards
                  rather than one ladder. */}
              {action?.(tier) && (
                <div className="mt-auto pt-1">{action(tier)}</div>
              )}
            </li>
          );
        })}
      </ul>

      {/* WHAT YOUR RUNG CANNOT REACH, in one line under the grid. The columns
          above answer "what would I get"; this answers "what am I missing",
          which is the same fact from the side an operator on Free actually
          feels. It counts rather than lists: the names are in the columns. */}
      <LockedLine current={current} />
    </section>
  );
}

function LockedLine({ current }: { current: PlanTier }) {
  const locked = SPECS.filter(
    (spec) => !spec.soon && !planAtLeast(current, spec.minPlan),
  );
  if (locked.length === 0) {
    return (
      <p className="text-muted-foreground mt-3 text-[12px] leading-snug">
        You are on the top rung. Every product Mesita runs is open here.
      </p>
    );
  }
  return (
    <p className="text-muted-foreground mt-3 text-[12px] leading-snug">
      {locked.length === 1 ? "One product is" : `${locked.length} products are`}{" "}
      locked on {PLAN_LABEL[current]}. Each one says which rung opens it on its
      own screen.
    </p>
  );
}
