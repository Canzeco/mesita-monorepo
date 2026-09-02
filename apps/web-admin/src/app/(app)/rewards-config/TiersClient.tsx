"use client";

import { AlertTriangle } from "lucide-react";

import { Collapsible, KnobStatus } from "@/components/admin-ui/config";
import { RateSelect } from "./promos-ui";
import { usePromosState } from "./PromosState";
import {
  ACTION_KEYS,
  BONUS_META,
  CLASS_KEYS,
  CLASS_META,
  LIVE_STRATEGY_KEYS,
  PLAN_KEYS,
  PLAN_META,
  STRATEGY_META,
  modelWarnings,
  totalFor,
  type ActionKey,
  type ClassKey,
  type StrategyKey,
} from "./promos";

// TIERS — one comparison table. Labels once on the left; Conservative and
// Aggressive are columns. A place picks ONE column; that column is the whole
// program. Floor first, then signed adders. Pinned rungs (Bronze, Free) are
// an em dash — "0%" is a real rate and would read as one.
//
// Rewards Config prices VISITS only. Orders and prepaid are not reward
// contexts on this page. The blob still carries a parked orders grid;
// Save round-trips it without knobs. Dominant stays in the blob for leftover
// rows and is not a column here.

const PREVIEW_ACTION_LABEL: Record<ActionKey, string> = {
  standing: "Base",
  mesita_review: "+ Mesita Review",
  story: "+ Instagram Story",
  review: "+ Google Review",
  welcome: "+ Welcome",
};

const ACTION_BONUS_KEYS = ["story", "google", "mesita"] as const;

const COL_COUNT = 1 + LIVE_STRATEGY_KEYS.length;

function GroupRow({ label }: { label: string }) {
  return (
    <tr>
      <th
        scope="colgroup"
        colSpan={COL_COUNT}
        className="text-muted-foreground pt-4 pb-1 type-meta font-bold tracking-[0.12em] uppercase"
      >
        {label}
      </th>
    </tr>
  );
}

function LabelCell({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <th scope="row" className="border-border/60 border-t py-2 pr-4 text-left">
      <p className="text-foreground truncate type-body font-semibold">{label}</p>
      <p
        className="text-muted-foreground h-4 truncate type-label leading-4"
        title={hint || undefined}
      >
        {hint || "\u00a0"}
      </p>
    </th>
  );
}

function RateCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="border-border/60 border-t py-2">
      <div className="flex h-9 items-center justify-end">{children}</div>
    </td>
  );
}

export function TiersClient() {
  const { cfg, visits, setVisits, setBonus, pending, seeded, loadBlocked, ladderError } =
    usePromosState();
  const warnings = modelWarnings(cfg);

  const setBase = (strategy: StrategyKey, v: number) =>
    setVisits({ ...visits, [strategy]: { ...visits[strategy], base: v } });

  const setClass = (strategy: StrategyKey, c: ClassKey, v: number) =>
    setVisits({
      ...visits,
      [strategy]: {
        ...visits[strategy],
        class: { ...visits[strategy].class, [c]: v },
      },
    });

  const setPlanPremium = (strategy: StrategyKey, v: number) =>
    setVisits({
      ...visits,
      [strategy]: {
        ...visits[strategy],
        plan: { ...visits[strategy].plan, premium: v },
      },
    });

  return (
    <div className="flex flex-col gap-4">
      {seeded && !loadBlocked && (
        <p className="border-border bg-muted/50 text-muted-foreground rounded-lg border px-3 py-2 text-xs">
          Nothing is saved yet — launch defaults. Review, then Save.
        </p>
      )}

      {ladderError && (
        <div className="rounded-lg border border-red-300/70 bg-red-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 type-label font-bold tracking-[0.12em] text-red-900 uppercase">
            <AlertTriangle className="h-3.5 w-3.5" />
            Cannot save
          </p>
          <p className="mt-1 type-body leading-snug text-red-900">
            {ladderError}
          </p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 type-label font-bold tracking-[0.12em] text-amber-900 uppercase">
            <AlertTriangle className="h-3.5 w-3.5" />
            Ladder check
          </p>
          <ul className="mt-1.5 space-y-1">
            {warnings.map((w) => (
              <li key={w.key} className="type-body leading-snug text-amber-900">
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* -mx-5 matches the super box's own p-5, so the scrollport reaches the
          screen edge on a phone. The padding rides on the scroller, not the
          <table> — padding on a table box is not honoured consistently and
          left the first rung's label flush against the edge. */}
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[36rem] border-separate border-spacing-0">
          <caption className="sr-only">
            Visit strategy rates. Conservative and Aggressive. Floor, then
            signed adders.
          </caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="w-[min(40%,16rem)] pb-3 pr-4">
                <span className="sr-only">Rung</span>
              </th>
              {LIVE_STRATEGY_KEYS.map((s) => (
                <th key={s} scope="col" className="pb-3">
                  <p className="font-display text-base font-semibold tracking-tight">
                    {STRATEGY_META[s].name}
                  </p>
                  <div className="mt-1.5">
                    <KnobStatus kind="enforced" reason="THE TICKET" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <LabelCell
                label="Base"
                hint="Standing rate, before anything is earned"
              />
              {LIVE_STRATEGY_KEYS.map((s) => (
                <RateCell key={s}>
                  <RateSelect
                    value={visits[s].base}
                    disabled={pending}
                    ariaLabel={`${STRATEGY_META[s].name} base standing rate`}
                    onChange={(v) => setBase(s, v)}
                  />
                </RateCell>
              ))}
            </tr>
            <tr>
              <LabelCell
                label={BONUS_META.welcome.name}
                hint={BONUS_META.welcome.qualifier}
              />
              {LIVE_STRATEGY_KEYS.map((s) => (
                <RateCell key={s}>
                  <RateSelect
                    value={cfg.visits.bonuses[s].welcome}
                    disabled={pending}
                    signed
                    ariaLabel={`${STRATEGY_META[s].name} Welcome bonus, adds`}
                    onChange={(v) => setBonus("visits", s, "welcome", v)}
                  />
                </RateCell>
              ))}
            </tr>

            <GroupRow label="Class" />
            {CLASS_KEYS.map((c) => (
              <tr key={c}>
                <LabelCell label={CLASS_META[c].name} />
                {LIVE_STRATEGY_KEYS.map((s) => (
                  <RateCell key={s}>
                    <RateSelect
                      value={visits[s].class[c]}
                      disabled={pending}
                      signed
                      pinned={c === "bronze"}
                      ariaLabel={`${STRATEGY_META[s].name} ${CLASS_META[c].name} class bonus, adds`}
                      onChange={(v) => setClass(s, c, v)}
                    />
                  </RateCell>
                ))}
              </tr>
            ))}

            <GroupRow label="Plan" />
            {PLAN_KEYS.map((p) => (
              <tr key={p}>
                <LabelCell label={PLAN_META[p].name} />
                {LIVE_STRATEGY_KEYS.map((s) => (
                  <RateCell key={s}>
                    <RateSelect
                      value={visits[s].plan[p]}
                      disabled={pending}
                      signed
                      pinned={p === "free"}
                      ariaLabel={`${STRATEGY_META[s].name} ${PLAN_META[p].name} plan bonus, adds`}
                      onChange={(v) => setPlanPremium(s, v)}
                    />
                  </RateCell>
                ))}
              </tr>
            ))}

            <GroupRow label="Actions" />
            {ACTION_BONUS_KEYS.map((k) => (
              <tr key={k}>
                <LabelCell
                  label={BONUS_META[k].name}
                  hint={BONUS_META[k].qualifier}
                />
                {LIVE_STRATEGY_KEYS.map((s) => (
                  <RateCell key={s}>
                    <RateSelect
                      value={cfg.visits.bonuses[s][k]}
                      disabled={pending}
                      signed
                      ariaLabel={`${STRATEGY_META[s].name} ${BONUS_META[k].name} bonus, adds`}
                      onChange={(v) => setBonus("visits", s, k, v)}
                    />
                  </RateCell>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground type-label leading-snug">
        Floor, then signed adders. Class prices a body in the room.
      </p>

      <Collapsible summary="How a visit bill stacks">
        <p className="text-muted-foreground type-label max-w-2xl leading-relaxed">
          Standing (base + class + plan) plus Welcome plus every earned action,
          clamped to 100%, on the first cap-pesos. Only the integer percent
          leaves the server.
        </p>
      </Collapsible>

      <Collapsible summary="Preview all visit totals">
        <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[720px] border-collapse type-body">
            <thead>
              <tr className="border-border border-b-2">
                <th
                  scope="col"
                  className="text-muted-foreground pb-2 text-left type-meta font-bold tracking-[0.12em] uppercase"
                >
                  Strategy
                </th>
                <th
                  scope="col"
                  className="text-muted-foreground pb-2 text-left type-meta font-bold tracking-[0.12em] uppercase"
                >
                  Class · Plan
                </th>
                {ACTION_KEYS.map((a) => (
                  <th
                    key={a}
                    scope="col"
                    className="text-muted-foreground pb-2 text-right type-meta font-bold tracking-[0.12em] uppercase"
                  >
                    {PREVIEW_ACTION_LABEL[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIVE_STRATEGY_KEYS.map((s) =>
                CLASS_KEYS.map((cls, ci) =>
                  PLAN_KEYS.map((p, pi) => {
                    const last =
                      ci === CLASS_KEYS.length - 1 &&
                      pi === PLAN_KEYS.length - 1;
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
                          {ci === 0 && pi === 0 ? STRATEGY_META[s].name : ""}
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
          <p className="text-muted-foreground/80 mt-2 type-label leading-snug">
            Base + that one action. A real bill stacks several, clamped to 100%.
            Matching adjacent rungs are a dead climb.
          </p>
        </div>
      </Collapsible>
    </div>
  );
}
