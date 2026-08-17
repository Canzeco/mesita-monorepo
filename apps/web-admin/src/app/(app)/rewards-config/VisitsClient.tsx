"use client";

import { AlertTriangle, ChevronDown, Gift, Percent } from "lucide-react";

import { SectionCard } from "../enricher-config/atlas-ui";
import { formatShortDate } from "@/lib/format";
import { ResolvedLedger } from "./ResolvedLedger";
import { BoxRow, RateSelect, StrategyHeads } from "./promos-ui";
import { usePromosState } from "./PromosState";
import {
  ACTION_KEYS,
  BONUS_META,
  CLASS_KEYS,
  CLASS_META,
  PLAN_KEYS,
  PLAN_META,
  STRATEGY_KEYS,
  STRATEGY_META,
  modelWarnings,
  totalFor,
  type ActionKey,
} from "./promos";

// Visits — the local ladder, as FIVE boxes (MESITA-1069 redesign).
//
// Base is the floor; Welcome, Class, Plan and Actions all ADD to it. That
// relationship is the whole reason for the layout: split into components, a
// row reading "15" is ambiguous between "pays 15" and "adds 15", and getting
// it backwards sets real discount rates wrong. So Base renders as one weighted
// card and every other box renders its values SIGNED.
//
// Welcome is its own box, not part of the floor: it is conditional (first
// verified ticket at the place), so it cannot be part of a standing rate.

const PREVIEW_ACTION_LABEL: Record<ActionKey, string> = {
  standing: "Base",
  mesita_review: "+ Mesita",
  story: "+ Story",
  review: "+ Google",
  welcome: "+ Welcome",
};

const STRATEGY_NAMES = STRATEGY_KEYS.map((s) => STRATEGY_META[s].name);

export function VisitsClient() {
  const {
    cfg,
    visits,
    setVisits,
    setBonus,
    pending,
    seeded,
    loadBlocked,
    updatedAt,
    ladderError,
  } = usePromosState();

  const warnings = modelWarnings(cfg);

  const setBase = (s: (typeof STRATEGY_KEYS)[number], v: number) =>
    setVisits({ ...visits, [s]: { ...visits[s], base: v } });
  const setClass = (
    s: (typeof STRATEGY_KEYS)[number],
    c: (typeof CLASS_KEYS)[number],
    v: number,
  ) =>
    setVisits({
      ...visits,
      [s]: { ...visits[s], class: { ...visits[s].class, [c]: v } },
    });
  const setPlan = (s: (typeof STRATEGY_KEYS)[number], v: number) =>
    setVisits({
      ...visits,
      [s]: { ...visits[s], plan: { ...visits[s].plan, premium: v } },
    });

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

      {/* 1. BASE — the floor. Weighted so it never reads as a peer. */}
      <SectionCard
        icon={<Percent className="text-secondary h-4 w-4" />}
        title="Base reward · the floor"
        subtitle="What every guest gets in the room for showing up. Class, Plan and the actions all add on top of this."
        status={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {formatShortDate(updatedAt)}
            </span>
          ) : null
        }
      >
        <div className="bg-muted/40 border-border/70 mt-4 rounded-xl border p-3">
          <StrategyHeads names={STRATEGY_NAMES} />
          <BoxRow label="Standing rate">
            {STRATEGY_KEYS.map((s) => (
              <RateSelect
                key={s}
                value={visits[s].base}
                disabled={pending}
                ariaLabel={`${STRATEGY_META[s].name} base standing rate`}
                onChange={(v) => setBase(s, v)}
              />
            ))}
          </BoxRow>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* 2. WELCOME — conditional, so an adder, not part of the floor. */}
        <SectionCard
          icon={<Gift className="text-secondary h-4 w-4" />}
          title="+ Welcome"
          subtitle="One-time, on the guest's first verified ticket at the place."
        >
          <div className="mt-3">
            <BoxRow
              label={BONUS_META.welcome.name}
              emoji={BONUS_META.welcome.emoji}
              hint={BONUS_META.welcome.qualifier}
            >
              <RateSelect
                value={cfg.visits.bonuses.welcome}
                disabled={pending}
                signed
                ariaLabel="Welcome bonus on a visit, adds"
                onChange={(v) => setBonus("visits", "welcome", v)}
              />
            </BoxRow>
          </div>
        </SectionCard>

        {/* 3. CLASS — who you are. Bronze is the pinned baseline. */}
        <SectionCard
          icon={<Percent className="text-secondary h-4 w-4" />}
          title="+ Class"
          subtitle="Presence priced per visit — the ladder a guest climbs. Never purchasable."
        >
          <div className="mt-3">
            <StrategyHeads names={STRATEGY_NAMES} />
            {CLASS_KEYS.map((c) => (
              <BoxRow key={c} label={CLASS_META[c].name} emoji={CLASS_META[c].emoji}>
                {STRATEGY_KEYS.map((s) => (
                  <RateSelect
                    key={s}
                    value={visits[s].class[c]}
                    disabled={pending}
                    signed
                    pinned={c === "bronze"}
                    ariaLabel={`${STRATEGY_META[s].name} ${CLASS_META[c].name} class bonus, adds`}
                    onChange={(v) => setClass(s, c, v)}
                  />
                ))}
              </BoxRow>
            ))}
          </div>
        </SectionCard>

        {/* 4. PLAN — what you pay. Free is the pinned baseline. */}
        <SectionCard
          icon={<Percent className="text-secondary h-4 w-4" />}
          title="+ Plan"
          subtitle="The rung the guest paid for. Private — the place sees the resolved percent, never who earned it."
        >
          <div className="mt-3">
            <StrategyHeads names={STRATEGY_NAMES} />
            {PLAN_KEYS.map((k) => (
              <BoxRow key={k} label={PLAN_META[k].name} emoji={PLAN_META[k].emoji}>
                {STRATEGY_KEYS.map((s) => (
                  <RateSelect
                    key={s}
                    value={visits[s].plan[k]}
                    disabled={pending}
                    signed
                    pinned={k === "free"}
                    ariaLabel={`${STRATEGY_META[s].name} ${PLAN_META[k].name} plan bonus, adds`}
                    onChange={(v) => setPlan(s, v)}
                  />
                ))}
              </BoxRow>
            ))}
          </div>
        </SectionCard>

        {/* 5. ACTIONS — what the guest did. One rate each, all strategies. */}
        <SectionCard
          icon={<Gift className="text-secondary h-4 w-4" />}
          title="+ Actions"
          subtitle="Earned per ticket. Same for every strategy, class and plan."
        >
          <div className="mt-3">
            {(["story", "mesita", "google"] as const).map((k) => (
              <BoxRow
                key={k}
                label={BONUS_META[k].name}
                emoji={BONUS_META[k].emoji}
                hint={BONUS_META[k].qualifier}
              >
                <RateSelect
                  value={cfg.visits.bonuses[k]}
                  disabled={pending}
                  signed
                  ariaLabel={`${BONUS_META[k].name} bonus on a visit, adds`}
                  onChange={(v) => setBonus("visits", k, v)}
                />
              </BoxRow>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* The all-16 resolved matrix. Under a COMPONENT editor this stops being
          a nicety: the ledger resolves one guest, so only this table can show
          that two adjacent rungs both clamped to the ceiling and became a tie
          — which this codebase treats as a dead rung. */}
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
    </div>
  );
}
