"use client";

// Rewards — what a place GIVES BACK, and the six things it decides about that.
//
// IT IS A MONEY PRODUCT, and that is why it sits beside Payments and Credits
// rather than beside Visits. Visits is the container guests arrive through;
// Rewards is the dial.
//
// REWARDS ARE VISIT-ONLY. A reward is earned by showing up and closing a bill,
// never by placing an order — an order is prepaid and has no table to reward.
//
// ── SIX ROWS, NOT NINE RUNGS (MESITA-2017) ─────────────────────────────────
//
// This page used to be two tables: a ladder priced by strategy column, and
// the stack those columns added up to. Pato killed the columns on 2026-09-20
// — a restaurant should not have to think about "aggressive" — so the rates
// are Mesita's now (`lib/rewards.ts`) and the operator decides six things,
// each one a row in one card:
//
//   program on · discount or cashback · cap · welcome · story · Mesita review
//
// THE STACK STAYS, shorter. An owner who sets a program without ever seeing
// the ceiling is an owner who meets it on a ticket, and the peso under it is
// what keeps the ceiling from being a night: "up to $X per visit, all bonuses
// combined" is the one sentence this screen owes.
//
// CASHBACK NEEDS PREPAID CREDITS, which is Ultra's. The row never hides: it
// stays visible, disabled, with the reason and the door, because a hidden
// option teaches an operator the product does not exist.
//
// ── SETUP STANDARD (MESITA-2034, D15/D16) ───────────────────────────────────
//
// "Comes back as" and "Cap per visit" become native Selects (D4) — the
// `aria-pressed` pill pairs a screen reader announced as unlabelled buttons.
// The commit bar keeps its own shape (D16's SaveBar model): one line naming
// what's dirty, Cancel ghost, Save primary, rendered only while dirty — this
// screen already had exactly that shape, so it stays rather than being
// rewired onto Profile's PlaceSaveBar, which is wired to a different form
// context this screen does not use.
import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Group } from "@/components/shared/Group";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
import { Table, type Column } from "@/components/shared/Table";
import { EmptyState } from "@/components/shared/EmptyState";
import { Tiles } from "@/components/shared/Tiles";
import { Rule } from "@/components/shared/Rule";
import { Badge } from "@/components/shared/Badges";
import { VISITS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { dayTime, money } from "@/lib/format";
import { PLAN_LABEL, planAtLeast, type MockVisit } from "@/mock/types";
import { productKeyHref } from "@/lib/product-routes";
import {
  ACTION_HINT,
  ACTION_KEYS,
  ACTION_LABEL,
  CAPS_MXN,
  MODE_LABEL,
  capCostCents,
  ceiling,
  stack,
  type RewardsMode,
  type RewardsProgram,
} from "@/lib/rewards";
import { GHOST_PILL_BUTTON_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

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

  // SAVED is what this place is running; the rest is the draft. The seed is
  // compared during render rather than synced in an effect — setState in
  // useEffect is a lint error on Next 16, and an effect would also paint one
  // frame of the previous place's program.
  const fromPlace: RewardsProgram = { on: place.visitRewards, ...place.rewards };
  const seed = `${place.id}:${JSON.stringify(fromPlace)}`;
  const [seeded, setSeeded] = useState(seed);
  const [saved, setSaved] = useState<RewardsProgram>(fromPlace);
  const [draft, setDraft] = useState<RewardsProgram>(fromPlace);
  const [justSaved, setJustSaved] = useState(false);
  if (seeded !== seed) {
    setSeeded(seed);
    setSaved(fromPlace);
    setDraft(fromPlace);
    setJustSaved(false);
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const off = !draft.on;
  const set = (patch: Partial<RewardsProgram>) => setDraft((d) => ({ ...d, ...patch }));

  // CASHBACK IS GATED TWICE: by the Credits switch on this place, and by the
  // rung Credits lives on. Either one missing disables the row with its
  // reason; the door goes to whichever is the nearer fix.
  const creditsRung = planAtLeast(place.plan, "ultra");
  const cashbackOk = creditsRung && place.credits;
  const cashbackWhy = !creditsRung
    ? `Needs Prepaid Credits (${PLAN_LABEL.ultra})`
    : "Needs Prepaid Credits on";
  const creditsHref = productKeyHref(place.id, "products", "credits");

  const noActions = draft.on && !draft.welcome && !draft.story && !draft.mesita;
  const steps = stack(draft);
  const top = ceiling(draft);

  const visits = listFor(VISITS.filter((v) => v.placeId === place.id), scenario);
  const earned = visits.filter((v) => v.rewardCents > 0);
  const given = earned.reduce((n, v) => n + v.rewardCents, 0);
  // THE ACTIVITY HALF'S TABLE, and deliberately not the Visits one. Visits
  // answers "what happened at the table"; this answers "what did the program
  // pay out", so it shows only the visits that earned something, how much,
  // and AS WHAT — a discount left the bill, cashback became a balance.
  const kind = saved.mode;
  const earnedColumns: Column<MockVisit>[] = [
    { key: "guest", head: "Guest", cell: (v) => <span className="font-medium">{v.guest}</span> },
    { key: "at", head: "When", cell: (v) => <span className="text-muted-foreground">{dayTime(v.at)}</span> },
    { key: "kind", head: "As", cell: () => <Badge>{kind}</Badge> },
    { key: "reward", head: "Given back", align: "right", cell: (v) => <span className="font-semibold tabular-nums">{money(v.rewardCents)}</span> },
  ];

  function save() {
    setSaved(draft);
    setJustSaved(true);
    // Plain timeout in the handler, never an effect. React drops a setState on
    // an unmounted component, so this needs no teardown.
    setTimeout(() => setJustSaved(false), 4000);
  }

  return (
    <div className="flex flex-col gap-4">
      <Half label="Manage">
        <Group
          title="The program"
          description="Six things this place decides. The rates are Mesita's; your cap is the ceiling."
          footer={noActions ? "No bonuses active — every visit pays the base and nothing more." : undefined}
        >
          {/* CASHBACK PAUSED IS A STATE, NOT AN ERROR. Credits went off while
              cashback was the mode: what guests hold stays redeemable, and
              new visits fall back to a discount until Credits is back. */}
          <Rule
            label="Rewards"
            note={off ? "Off. Guests still find, review and book this place; they just pay the whole bill." : "On. The next bill closed here runs what is below."}
            control={{ kind: "switch", on: draft.on, onChange: (on) => set({ on }), label: "Rewards" }}
          />
          <Rule
            label="Comes back as"
            note={
              place.cashbackPaused ? (
                <>
                  Cashback is paused: Prepaid Credits is off here, so new visits get
                  a discount instead. Balances guests already hold are still theirs
                  to spend.{" "}
                  <Link href={creditsHref} className="underline underline-offset-4">
                    Open Prepaid Credits
                  </Link>
                </>
              ) : cashbackOk ? (
                "A discount leaves this bill; cashback becomes a balance for the next one."
              ) : (
                <>
                  {cashbackWhy}.{" "}
                  <Link href={creditsHref} className="underline underline-offset-4">
                    Prepaid Credits
                  </Link>
                </>
              )
            }
            disabled={off}
            control={{
              kind: "select",
              value: draft.mode,
              onChange: (v) => set({ mode: v as RewardsMode }),
              options: (["discount", "cashback"] as RewardsMode[]).map((m) => ({
                value: m,
                label: m === "cashback" && !cashbackOk ? `${MODE_LABEL[m]} (needs Credits)` : MODE_LABEL[m],
              })),
            }}
          />
          <Rule
            label="Cap per visit"
            note={`Up to ${pesos(draft.cap)} per visit, all bonuses combined. Every rate applies to the first ${pesos(draft.cap)} of the bill.`}
            disabled={off}
            control={{
              kind: "select",
              value: String(draft.cap),
              onChange: (v) => set({ cap: Number(v) as RewardsProgram["cap"] }),
              options: CAPS_MXN.map((c) => ({ value: String(c), label: pesos(c) })),
            }}
          />
          {ACTION_KEYS.map((key) => (
            <Rule
              key={key}
              label={ACTION_LABEL[key]}
              note={ACTION_HINT[key]}
              disabled={off}
              control={{ kind: "switch", on: draft[key], onChange: (v) => set({ [key]: v }), label: ACTION_LABEL[key] }}
            />
          ))}
        </Group>

        <Group
          title="What that stacks to"
          description="Left to right is the addition: each step adds one more bonus to the one before it. The peso under every total is the most it can cost, at this cap."
          footer="Rewards on orders is not a thing, and will not be — a reward is earned by turning up, an order is prepaid and has no table. Use Credits for the prepaid case."
        >
          {off ? (
            /* The empty state is a feature. A row of 0% says the page is
               broken rather than that the place has chosen something. */
            <div className="flex min-h-[20vh] flex-col items-center justify-center gap-2 px-4 py-8 text-center">
              <p className="text-muted-foreground max-w-[42ch] text-[13px] leading-snug">
                Nothing is given back here. Turn Rewards on above to see what a visit would earn.
              </p>
            </div>
          ) : (
            <div className="p-3">
              <ol className="flex flex-wrap gap-2">
                {steps.map((s) => (
                  <li
                    key={s.key}
                    className="border-border flex min-w-[7.5rem] flex-1 flex-col rounded-xl border px-3 py-2.5"
                  >
                    {/* Not the shared small-caps eyebrow token: that
                        treatment belongs to Activity's tiles (D17 bans it
                        from a Manage-half Group, which is where this
                        stack lives). */}
                    <span className="text-muted-foreground text-[11px] font-semibold">{s.label}</span>
                    <span className={cn(NUM, "mt-1")}>{s.total}%</span>
                    <span className="text-muted-foreground text-[11px] font-semibold tabular-nums">
                      {pesos(capCostCents(s.total, draft.cap) / 100)}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-muted-foreground mt-3 text-[12px] leading-snug">
                A percentage is not a peso. Every rate above applies to the first{" "}
                {pesos(draft.cap)} of the bill, so a guest who earns everything you
                have on costs you {pesos(capCostCents(top, draft.cap) / 100)},
                whatever they ordered. Mesita sets the bonuses; your cap is the
                ceiling.
              </p>
            </div>
          )}
        </Group>
      </Half>

      <Half label="Activity">
        <Tiles
          tiles={[
            {
              label: "Given back",
              value: earned.length ? money(given) : null,
              hint: `Across ${earned.length} rewarded visit${earned.length === 1 ? "" : "s"}, listed below`,
            },
            {
              label: "As",
              value: earned.length ? MODE_LABEL[saved.mode] : null,
              hint: saved.mode === "cashback" ? "Banked as Prepaid Credits" : "Taken off the bill",
            },
          ]}
        />
        <Section
          title="What the program paid out"
          description="Every visit that earned something, newest first. The bill each guest actually paid is on Visits."
        >
          <Table
            columns={earnedColumns}
            rows={earned}
            empty={
              <EmptyState
                title="Nothing given back yet"
                hint={
                  saved.on
                    ? "A visit appears here the first time the program pays out."
                    : "The program is off, so no visit can earn anything."
                }
              />
            }
          />
        </Section>
      </Half>

      {/* THE COMMIT BAR (D16) — one line naming what's dirty, Cancel ghost,
          Save primary, rendered only while dirty. A permanent Save that
          looks identical before and after a click cannot answer the one
          question an owner asks on a money screen: did that take? */}
      {dirty && (
        <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {draft.on ? `${MODE_LABEL[draft.mode]}, capped at ${pesos(draft.cap)}` : "Rewards off"}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[12px]">
              Applies to the next bill closed here. Nothing retroactive, ever.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft(saved)}
              className={GHOST_PILL_BUTTON_CLASS}
            >
              Cancel
            </button>
            <button type="button" onClick={save} className={PILL_BUTTON_CLASS}>
              Save
            </button>
          </div>
        </div>
      )}
      {!dirty && justSaved && (
        <p className="text-muted-foreground flex items-center gap-2 px-1 text-[12px]">
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Saved. The next bill closed here runs {saved.on ? MODE_LABEL[saved.mode].toLowerCase() : "nothing"}
          {saved.on ? `, capped at the first ${pesos(saved.cap)}.` : "."}
        </p>
      )}
    </div>
  );
}
