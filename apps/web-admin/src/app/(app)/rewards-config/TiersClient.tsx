"use client";

import { AlertTriangle, ChevronDown, Coins, Info } from "lucide-react";

import { SectionCard } from "../enricher-config/atlas-ui";
import { formatShortDate } from "@/lib/format";
import { ResolvedLedger } from "./ResolvedLedger";
import { BoxRow, RateSelect, SoonPill } from "./promos-ui";
import { usePromosState } from "./PromosState";
import {
  ACTION_KEYS,
  ALLOWED_CAPS,
  BONUS_META,
  CLASS_KEYS,
  CLASS_META,
  CONTEXT_META,
  PLAN_KEYS,
  PLAN_META,
  STRATEGY_KEYS,
  STRATEGY_META,
  modelWarnings,
  totalFor,
  type ActionKey,
  type ContextKey,
  type StrategyKey,
} from "./promos";

// TIERS — four boxes, one per (strategy × context).
//
//   Conservative · Visits     Aggressive · Visits
//   Conservative · Orders     Aggressive · Orders
//
// A place picks ONE strategy, so a box is exactly what that place pays in
// that context: the whole ladder in one place, top to bottom. The earlier
// split — a subpage per context, boxes per component — made an operator hold
// two screens in their head to answer "what does a Conservative place give?".
//
// Every box reads the same way: the FLOOR first, then everything that adds to
// it, signed. Pinned rungs (Bronze, Free) show an em dash — they are the
// baseline the offsets are measured from, and "0%" would read as a rate.
//
// ORDERS has no Class rows at all. Class prices presence, and a delivery order
// has nobody in the chair (Notion §2.8). It is also PARKED: the knobs save,
// but no ticket carries a remote context yet, so nothing reads them.

const PREVIEW_ACTION_LABEL: Record<ActionKey, string> = {
  standing: "Base",
  mesita_review: "+ Mesita",
  story: "+ Story",
  review: "+ Google",
  welcome: "+ Welcome",
};

function TierBox({
  strategy,
  context,
}: {
  strategy: StrategyKey;
  context: ContextKey;
}) {
  const { cfg, visits, orders, setVisits, setOrders, setBonus, pending } =
    usePromosState();

  const isVisits = context === "visits";
  const comp = isVisits ? visits[strategy] : orders[strategy];
  const bonuses = cfg[context].bonuses[strategy];

  const setBase = (v: number) =>
    isVisits
      ? setVisits({ ...visits, [strategy]: { ...visits[strategy], base: v } })
      : setOrders({ ...orders, [strategy]: { ...orders[strategy], base: v } });

  const setClass = (c: (typeof CLASS_KEYS)[number], v: number) =>
    setVisits({
      ...visits,
      [strategy]: {
        ...visits[strategy],
        class: { ...visits[strategy].class, [c]: v },
      },
    });

  const setPlan = (v: number) =>
    isVisits
      ? setVisits({
          ...visits,
          [strategy]: {
            ...visits[strategy],
            plan: { ...visits[strategy].plan, premium: v },
          },
        })
      : setOrders({
          ...orders,
          [strategy]: {
            ...orders[strategy],
            plan: { ...orders[strategy].plan, premium: v },
          },
        });

  const label = `${STRATEGY_META[strategy].name} · ${CONTEXT_META[context].name}`;

  return (
    <SectionCard
      icon={<span className="text-base leading-none">{STRATEGY_META[strategy].emoji}</span>}
      title={label}
      subtitle={
        isVisits
          ? "A body in the room. Everything below adds onto the floor."
          : "Pickup and delivery. No class rung — presence is what class buys."
      }
      status={isVisits ? undefined : <SoonPill />}
    >
      <div className="mt-3">
        {/* THE FLOOR — plain, not signed, and visually set apart. */}
        <div className="bg-muted/40 border-border/70 mb-2 rounded-lg border px-3 py-1">
          <BoxRow label="Base" hint="The standing rate, before anything is earned">
            <RateSelect
              value={comp.base}
              disabled={pending}
              ariaLabel={`${label} base standing rate`}
              onChange={setBase}
            />
          </BoxRow>
        </div>

        <BoxRow
          label={BONUS_META.welcome.name}
          emoji={BONUS_META.welcome.emoji}
          hint={BONUS_META.welcome.qualifier}
        >
          <RateSelect
            value={bonuses.welcome}
            disabled={pending}
            signed
            ariaLabel={`${label} Welcome bonus, adds`}
            onChange={(v) => setBonus(context, strategy, "welcome", v)}
          />
        </BoxRow>

        {isVisits && (
          <>
            <p className="text-muted-foreground pt-3 pb-0.5 text-[10px] font-bold tracking-[0.12em] uppercase">
              Class · who they are
            </p>
            {CLASS_KEYS.map((c) => (
              <BoxRow key={c} label={CLASS_META[c].name} emoji={CLASS_META[c].emoji}>
                <RateSelect
                  value={visits[strategy].class[c]}
                  disabled={pending}
                  signed
                  pinned={c === "bronze"}
                  ariaLabel={`${label} ${CLASS_META[c].name} class bonus, adds`}
                  onChange={(v) => setClass(c, v)}
                />
              </BoxRow>
            ))}
          </>
        )}

        <p className="text-muted-foreground pt-3 pb-0.5 text-[10px] font-bold tracking-[0.12em] uppercase">
          Plan · what they pay
        </p>
        {PLAN_KEYS.map((k) => (
          <BoxRow key={k} label={PLAN_META[k].name} emoji={PLAN_META[k].emoji}>
            <RateSelect
              value={comp.plan[k]}
              disabled={pending}
              signed
              pinned={k === "free"}
              ariaLabel={`${label} ${PLAN_META[k].name} plan bonus, adds`}
              onChange={setPlan}
            />
          </BoxRow>
        ))}

        <p className="text-muted-foreground pt-3 pb-0.5 text-[10px] font-bold tracking-[0.12em] uppercase">
          Actions · what they did
        </p>
        {(["story", "mesita", "google"] as const).map((k) => (
          <BoxRow
            key={k}
            label={BONUS_META[k].name}
            emoji={BONUS_META[k].emoji}
            hint={BONUS_META[k].qualifier}
          >
            <RateSelect
              value={bonuses[k]}
              disabled={pending}
              signed
              ariaLabel={`${label} ${BONUS_META[k].name} bonus, adds`}
              onChange={(v) => setBonus(context, strategy, k, v)}
            />
          </BoxRow>
        ))}
      </div>
    </SectionCard>
  );
}

export function TiersClient() {
  const { cfg, setCap, pending, seeded, loadBlocked, updatedAt, ladderError } =
    usePromosState();
  const warnings = modelWarnings(cfg);

  return (
    <div className="space-y-5">
      {seeded && !loadBlocked && (
        <p className="border-border bg-muted/50 text-muted-foreground rounded-lg border px-3 py-2 text-xs">
          These knobs were derived from the previous model — review them, then
          Save.
        </p>
      )}

      {ladderError && (
        <div className="rounded-lg border border-red-300/70 bg-red-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-red-900 uppercase">
            <AlertTriangle className="h-3.5 w-3.5" />
            Cannot save
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-red-900">
            {ladderError}
          </p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-amber-900 uppercase">
            <AlertTriangle className="h-3.5 w-3.5" />
            Ladder check
          </p>
          <ul className="mt-1.5 space-y-1">
            {warnings.map((w) => (
              <li key={w.key} className="text-[12.5px] leading-snug text-amber-900">
                {w.message}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-amber-900/75">
            Reported, never auto-corrected — this is money, so the call is yours.
          </p>
        </div>
      )}

      <ResolvedLedger cfg={cfg} />

      {updatedAt && (
        <p className="text-muted-foreground -mb-1 text-right text-xs">
          Updated {formatShortDate(updatedAt)}
        </p>
      )}

      {/* THE FOUR TIERS. One column per strategy: a place picks one, and
          reading down its column gives the whole program for that posture. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {STRATEGY_KEYS.map((s) => (
          <div key={s} className="space-y-5">
            <TierBox strategy={s} context="visits" />
            <TierBox strategy={s} context="orders" />
          </div>
        ))}
      </div>

      <p className="border-border bg-muted/50 text-muted-foreground flex items-start gap-1.5 rounded-lg border px-3 py-2 text-xs">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="text-foreground font-semibold">
            Orders tiers are staged.
          </span>{" "}
          They save to the live config, but no ticket carries a remote context
          yet, so nothing reads them and no order has ever been discounted.
        </span>
      </p>

      {/* The all-16 resolved matrix. Under a component editor this is the only
          surface that can show two adjacent rungs clamping to the ceiling and
          becoming a dead rung — the ledger only ever resolves one guest. */}
      <details className="border-border group rounded-xl border">
        <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium select-none">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          Preview all visit totals
        </summary>
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-border border-b-2">
                <th
                  scope="col"
                  className="text-muted-foreground pb-2 text-left text-[10px] font-bold tracking-[0.12em] uppercase"
                >
                  Strategy
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground pb-2 text-left text-[10px] font-bold tracking-[0.12em] uppercase"
                >
                  Class · Plan
                </th>
                {ACTION_KEYS.map((a) => (
                  <th
                    key={a}
                    scope="col"
                    className="text-muted-foreground pb-2 text-right text-[10px] font-bold tracking-[0.1em] uppercase"
                  >
                    {PREVIEW_ACTION_LABEL[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STRATEGY_KEYS.map((s) =>
                CLASS_KEYS.map((cls, ci) =>
                  PLAN_KEYS.map((p, pi) => {
                    const last =
                      ci === CLASS_KEYS.length - 1 && pi === PLAN_KEYS.length - 1;
                    return (
                      <tr
                        key={`${s}|${cls}|${p}`}
                        className={
                          last
                            ? "border-border border-b-2 last:border-0"
                            : "border-border border-b"
                        }
                      >
                        <th
                          scope="row"
                          className="py-1.5 pr-3 text-left font-bold whitespace-nowrap"
                        >
                          {ci === 0 && pi === 0
                            ? `${STRATEGY_META[s].emoji} ${STRATEGY_META[s].name}`
                            : ""}
                        </th>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {pi === 0 ? CLASS_META[cls].name : ""}
                          <span className="text-muted-foreground">
                            {pi === 0 ? " · " : ""}
                            {PLAN_META[p].name}
                          </span>
                        </td>
                        {ACTION_KEYS.map((a) => (
                          <td
                            key={a}
                            className="py-1.5 text-right font-mono font-semibold tabular-nums"
                          >
                            {Math.min(100, totalFor(cfg, s, cls, p, a))}%
                          </td>
                        ))}
                      </tr>
                    );
                  }),
                ),
              )}
            </tbody>
          </table>
          <p className="text-muted-foreground/80 mt-2 text-[11px] leading-snug">
            Base + that single action. A real bill stacks several, clamped to
            100%. Two adjacent rungs showing the same number are a dead rung —
            the higher one is paying nothing for the climb.
          </p>
        </div>
      </details>

      <SectionCard
        icon={<Coins className="text-secondary h-4 w-4" />}
        title="Default discount cap"
        subtitle="Fallback when a place has not picked its own cap. Applies to all four tiers."
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ALLOWED_CAPS.map((c) => {
            const active = cfg.cap === c;
            return (
              <button
                key={c}
                type="button"
                disabled={pending}
                onClick={() => setCap(c)}
                aria-pressed={active}
                className={
                  active
                    ? "bg-foreground text-background inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-bold tabular-nums transition disabled:opacity-50"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-9 items-center rounded-lg border px-3.5 text-[13px] font-semibold tabular-nums transition disabled:opacity-50"
                }
              >
                <Coins className="mr-1.5 h-3.5 w-3.5" />
                {c.toLocaleString("en-US")}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          The discount applies to the first{" "}
          <span className="text-foreground font-semibold">
            MX${cfg.cap.toLocaleString("en-US")}
          </span>{" "}
          of the bill.
        </p>
      </SectionCard>
    </div>
  );
}
