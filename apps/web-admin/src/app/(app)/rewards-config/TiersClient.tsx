"use client";

import { AlertTriangle } from "lucide-react";

import {
  Collapsible,
  KnobStatus,
  SectionCard,
} from "@/components/admin-ui/config";
import { BoxRow, RateSelect } from "./promos-ui";
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
  type StrategyKey,
} from "./promos";

// TIERS — two visit boxes, Conservative and Aggressive. A place picks ONE
// strategy; reading down a column is that place's whole program. Each box:
// floor first, then signed adders. Pinned rungs (Bronze, Free) are an em
// dash — "0%" is a real rate and would read as one.
//
// Promos Config prices VISITS only. Orders and prepaid are not reward
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

function TierBox({ strategy }: { strategy: StrategyKey }) {
  const { cfg, visits, setVisits, setBonus, pending } = usePromosState();

  const bonuses = cfg.visits.bonuses[strategy];
  const label = STRATEGY_META[strategy].name;

  const setBase = (v: number) =>
    setVisits({ ...visits, [strategy]: { ...visits[strategy], base: v } });

  const setClass = (c: (typeof CLASS_KEYS)[number], v: number) =>
    setVisits({
      ...visits,
      [strategy]: {
        ...visits[strategy],
        class: { ...visits[strategy].class, [c]: v },
      },
    });

  const setPlan = (v: number) =>
    setVisits({
      ...visits,
      [strategy]: {
        ...visits[strategy],
        plan: { ...visits[strategy].plan, premium: v },
      },
    });

  return (
    <SectionCard
      icon={<span className="bg-muted h-2.5 w-2.5 rounded-full" aria-hidden />}
      title={label}
      subtitle="Floor, then signed adders. Class prices a body in the room."
      status={<KnobStatus kind="enforced" reason="THE TICKET" />}
    >
      <div className="mt-3">
        <div className="bg-muted/40 border-border/70 mb-2 rounded-lg border px-3 py-1">
          <BoxRow label="Base" hint="Standing rate, before anything is earned">
            <RateSelect
              value={visits[strategy].base}
              disabled={pending}
              ariaLabel={`${label} base standing rate`}
              onChange={setBase}
            />
          </BoxRow>
        </div>

        <BoxRow
          label={BONUS_META.welcome.name}
          hint={BONUS_META.welcome.qualifier}
        >
          <RateSelect
            value={bonuses.welcome}
            disabled={pending}
            signed
            ariaLabel={`${label} Welcome bonus, adds`}
            onChange={(v) => setBonus("visits", strategy, "welcome", v)}
          />
        </BoxRow>

        <p className="text-muted-foreground pt-3 pb-0.5 type-meta font-bold tracking-[0.12em] uppercase">
          Class
        </p>
        {CLASS_KEYS.map((c) => (
          <BoxRow key={c} label={CLASS_META[c].name}>
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

        <p className="text-muted-foreground pt-3 pb-0.5 type-meta font-bold tracking-[0.12em] uppercase">
          Plan
        </p>
        {PLAN_KEYS.map((k) => (
          <BoxRow key={k} label={PLAN_META[k].name}>
            <RateSelect
              value={visits[strategy].plan[k]}
              disabled={pending}
              signed
              pinned={k === "free"}
              ariaLabel={`${label} ${PLAN_META[k].name} plan bonus, adds`}
              onChange={setPlan}
            />
          </BoxRow>
        ))}

        <p className="text-muted-foreground pt-3 pb-0.5 type-meta font-bold tracking-[0.12em] uppercase">
          Actions
        </p>
        {(["story", "google", "mesita"] as const).map((k) => (
          <BoxRow
            key={k}
            label={BONUS_META[k].name}
            hint={BONUS_META[k].qualifier}
          >
            <RateSelect
              value={bonuses[k]}
              disabled={pending}
              signed
              ariaLabel={`${label} ${BONUS_META[k].name} bonus, adds`}
              onChange={(v) => setBonus("visits", strategy, k, v)}
            />
          </BoxRow>
        ))}
      </div>
    </SectionCard>
  );
}

export function TiersClient() {
  const { cfg, seeded, loadBlocked, ladderError } = usePromosState();
  const warnings = modelWarnings(cfg);

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {LIVE_STRATEGY_KEYS.map((s) => (
          <TierBox key={s} strategy={s} />
        ))}
      </div>

      <Collapsible summary="How a visit bill stacks">
        <p className="text-muted-foreground type-label max-w-2xl leading-relaxed">
          Standing (base + class + plan) plus Welcome plus every earned action,
          clamped to 100%, on the first cap-pesos. Only the integer percent
          leaves the server.
        </p>
      </Collapsible>

      <Collapsible summary="Preview all visit totals">
        <div className="overflow-x-auto">
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
