"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  Coins,
  Gift,
  Info,
  Percent,
  RotateCcw,
} from "lucide-react";

import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import { SaveRow, SectionCard } from "../enricher-config/atlas-ui";
import { getPromosConfig, updatePromosConfig } from "./actions";
import {
  ACTION_KEYS,
  ALLOWED_CAPS,
  ALLOWED_RATES,
  BONUS_KEYS,
  BONUS_META,
  CLASS_KEYS,
  CLASS_META,
  CONTEXT_META,
  DEFAULT_PROMOS,
  PLAN_KEYS,
  PLAN_META,
  STRATEGY_KEYS,
  STRATEGY_META,
  modelWarnings,
  totalFor,
  type ActionKey,
  type BonusKey,
  type ClassKey,
  type PlanKey,
  type PromosConfig,
  type StrategyKey,
} from "./promos";

// The v11 promos editor (MESITA-1069). Context cuts first, so the page is two
// stacked ladders rather than one grid: VISITS prices the full identity grid
// (class × plan), ORDERS drops class and prices plan alone. One strategy per
// place governs both — the Conservative/Aggressive columns run straight
// through the page, and a place picking one gets that whole vertical slice.
//
// Orders is PARKED: the knobs are live and saved, but no ticket carries a
// remote context yet, so nothing reads them. Following the Ojo Config
// precedent, the console keeps saying so instead of hiding the section.

const PREVIEW_ACTION_LABEL: Record<ActionKey, string> = {
  standing: "Base",
  mesita_review: "+ Mesita Review",
  story: "+ Instagram Story",
  review: "+ Google Review",
  welcome: "+ Welcome",
};

export function PromosConfigClient({
  initialConfig,
  initialUpdatedAt,
  initialSeeded,
  loadError,
}: {
  initialConfig: PromosConfig;
  initialUpdatedAt: string | null;
  initialSeeded: boolean;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<PromosConfig>(initialConfig);
  const [saved, setSaved] = useState<PromosConfig>(initialConfig);
  const [seeded, setSeeded] = useState(initialSeeded);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  // Re-fetch on mount so a client-side nav shows the live blob, not a stale
  // server render. Success clears a failed-load Save block (MESITA-737).
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getPromosConfig();
      if (!active) return;
      if (!r.ok) {
        if (loadBlocked) setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setSeeded(r.seeded);
      setUpdatedAt(r.updatedAt);
      setError(null);
      setLoadBlocked(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(saved),
    [cfg, saved],
  );

  const warnings = useMemo(() => modelWarnings(cfg), [cfg]);

  const setVisitsBase = (
    strategy: StrategyKey,
    cls: ClassKey,
    plan: PlanKey,
    value: number,
  ) => {
    setCfg((c) => ({
      ...c,
      visits: {
        ...c.visits,
        base: {
          ...c.visits.base,
          [strategy]: {
            ...c.visits.base[strategy],
            [cls]: { ...c.visits.base[strategy][cls], [plan]: value },
          },
        },
      },
    }));
    setOk(false);
  };

  const setOrdersBase = (
    strategy: StrategyKey,
    plan: PlanKey,
    value: number,
  ) => {
    setCfg((c) => ({
      ...c,
      orders: {
        ...c.orders,
        base: {
          ...c.orders.base,
          [strategy]: { ...c.orders.base[strategy], [plan]: value },
        },
      },
    }));
    setOk(false);
  };

  const setBonus = (
    context: "visits" | "orders",
    key: BonusKey,
    value: number,
  ) => {
    setCfg((c) => ({
      ...c,
      [context]: {
        ...c[context],
        bonuses: { ...c[context].bonuses, [key]: value },
      },
    }));
    setOk(false);
  };

  const setCap = (value: number) => {
    setCfg((c) => ({ ...c, cap: value }));
    setOk(false);
  };

  const resetDefaults = () => {
    setCfg(structuredClone(DEFAULT_PROMOS));
    setOk(false);
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updatePromosConfig(cfg);
      if (r.ok) {
        setSaved(r.config);
        setCfg(r.config);
        setSeeded(false);
        setUpdatedAt(r.updatedAt);
        setOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  // The example strip narrates ONE bill so the additive rule stays concrete:
  // Aggressive · Diamond on Premium, first visit, posts a story.
  const example = useMemo(() => {
    const base = cfg.visits.base.aggressive.diamond.premium;
    const total = Math.min(
      100,
      base + cfg.visits.bonuses.welcome + cfg.visits.bonuses.story,
    );
    return { base, total };
  }, [cfg]);

  return (
    <div className="space-y-6">
      {seeded && !loadBlocked && (
        <p className="border-border bg-muted/50 text-muted-foreground flex items-start gap-1.5 rounded-lg border px-3 py-2 text-xs">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          These knobs were derived from the previous model — review them, then
          Save.
        </p>
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
            Reported, never auto-corrected — these are money, so the call is
            yours.
          </p>
        </div>
      )}

      {/* ── VISITS — the full identity grid ─────────────────────────────── */}
      <SectionCard
        icon={<Percent className="text-secondary h-4 w-4" />}
        title={`${CONTEXT_META.visits.emoji} Visits · base reward`}
        subtitle="The standing discount a guest gets in the room, by class and plan. Class is who they are; plan is what they pay."
        status={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {formatShortDate(updatedAt)}
            </span>
          ) : null
        }
      >
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <th className="pb-1" />
                {STRATEGY_KEYS.map((s) => (
                  <th
                    key={s}
                    scope="colgroup"
                    colSpan={PLAN_KEYS.length}
                    className="text-foreground border-border border-b pb-1.5 text-center text-[11px] font-bold tracking-[0.1em] uppercase"
                    title={STRATEGY_META[s].blurb}
                  >
                    {STRATEGY_META[s].emoji} {STRATEGY_META[s].name}
                  </th>
                ))}
              </tr>
              <tr className="border-border border-b-2">
                <th
                  scope="col"
                  className="text-muted-foreground pb-2 text-left text-[10px] font-bold tracking-[0.12em] uppercase"
                >
                  Class
                </th>
                {STRATEGY_KEYS.map((s) =>
                  PLAN_KEYS.map((p) => (
                    <th
                      key={`${s}|${p}`}
                      scope="col"
                      className="text-muted-foreground pb-2 text-center text-[10px] font-bold tracking-[0.1em] uppercase"
                      title={PLAN_META[p].blurb}
                    >
                      {PLAN_META[p].name}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {CLASS_KEYS.map((cls) => (
                <tr key={cls} className="border-border border-b last:border-0">
                  <th
                    scope="row"
                    className="py-2 pr-4 text-left text-[12.5px] font-semibold whitespace-nowrap"
                    title={CLASS_META[cls].blurb}
                  >
                    <span className="mr-1.5 text-base" aria-hidden>
                      {CLASS_META[cls].emoji}
                    </span>
                    {CLASS_META[cls].name}
                  </th>
                  {STRATEGY_KEYS.map((s) =>
                    PLAN_KEYS.map((p) => (
                      <td key={`${s}|${p}`} className="px-2 py-1.5 text-center">
                        <RateSelect
                          value={cfg.visits.base[s][cls][p]}
                          disabled={pending}
                          ariaLabel={`${STRATEGY_META[s].name} ${CLASS_META[cls].name} ${PLAN_META[p].name} visit base reward`}
                          onChange={(v) => setVisitsBase(s, cls, p, v)}
                        />
                      </td>
                    )),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-3 text-[11px] leading-snug">
          A place picks ONE strategy and it prices both ladders — there is no
          per-context choice. Plan never reaches the floor: the place sees the
          resolved percent, never who earned it.
        </p>
      </SectionCard>

      <SectionCard
        icon={<Gift className="text-secondary h-4 w-4" />}
        title={`${CONTEXT_META.visits.emoji} Visits · bonuses`}
        subtitle="Added on top of the base — same for every strategy, class and plan."
      >
        <BonusList
          bonuses={cfg.visits.bonuses}
          disabled={pending}
          contextLabel="visit"
          onChange={(k, v) => setBonus("visits", k, v)}
        />
      </SectionCard>

      {/* Live example — one bill, narrated (recomputes as knobs change). */}
      <div className="border-border bg-muted/40 rounded-xl border px-4 py-3">
        <p className="text-muted-foreground text-[12.5px]">
          Example, live as you edit —{" "}
          <span className="text-foreground font-mono font-semibold tabular-nums">
            ⚡ Aggressive · 💎 Diamond on Premium, first visit, posts a story →{" "}
            {example.base}% + {cfg.visits.bonuses.welcome}% +{" "}
            {cfg.visits.bonuses.story}% = {example.total}%
          </span>{" "}
          off the first MX${cfg.cap.toLocaleString("en-US")} (default cap).
        </p>
      </div>

      {/* Collapsed totals preview. */}
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
            Base + that single action. A real bill can stack several bonuses,
            clamped to 100%.
          </p>
        </div>
      </details>

      {/* ── ORDERS — parked, but real ───────────────────────────────────── */}
      <SectionCard
        icon={<Percent className="text-secondary h-4 w-4" />}
        title={`${CONTEXT_META.orders.emoji} Orders · base reward`}
        subtitle="Pickup and delivery. Class does not resolve here — presence is what class buys, and nobody is in the chair — so plan alone prices the row."
        status={<SoonPill />}
      >
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="border-border border-b-2">
                <th
                  scope="col"
                  className="text-muted-foreground pb-2 text-left text-[10px] font-bold tracking-[0.12em] uppercase"
                >
                  Plan
                </th>
                {STRATEGY_KEYS.map((s) => (
                  <th
                    key={s}
                    scope="col"
                    className="text-foreground pb-2 text-center text-[11px] font-bold tracking-[0.1em] uppercase"
                    title={STRATEGY_META[s].blurb}
                  >
                    {STRATEGY_META[s].emoji} {STRATEGY_META[s].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_KEYS.map((p) => (
                <tr key={p} className="border-border border-b last:border-0">
                  <th
                    scope="row"
                    className="py-2 pr-4 text-left text-[12.5px] font-semibold whitespace-nowrap"
                    title={PLAN_META[p].blurb}
                  >
                    {PLAN_META[p].name}
                  </th>
                  {STRATEGY_KEYS.map((s) => (
                    <td key={s} className="px-2 py-1.5 text-center">
                      <RateSelect
                        value={cfg.orders.base[s][p]}
                        disabled={pending}
                        ariaLabel={`${STRATEGY_META[s].name} ${PLAN_META[p].name} order base reward`}
                        onChange={(v) => setOrdersBase(s, p, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-3 text-[11px] leading-snug">
          A flatter, lower band than visits by design: remote buys volume, and
          the discount is funded out of the 25–30% a delivery app would have
          taken from the same order.
        </p>
      </SectionCard>

      <SectionCard
        icon={<Gift className="text-secondary h-4 w-4" />}
        title={`${CONTEXT_META.orders.emoji} Orders · bonuses`}
        subtitle="The three sharing actions run in both contexts — a story about a delivered dinner is reach all the same — but they are priced separately here."
        status={<SoonPill />}
      >
        <BonusList
          bonuses={cfg.orders.bonuses}
          disabled={pending}
          contextLabel="order"
          onChange={(k, v) => setBonus("orders", k, v)}
        />
      </SectionCard>

      <p className="border-border bg-muted/50 text-muted-foreground flex items-start gap-1.5 rounded-lg border px-3 py-2 text-xs">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="text-foreground font-semibold">
            Orders knobs are staged.
          </span>{" "}
          They save to the live blob, but no ticket carries a remote context
          yet, so nothing reads them and no order has ever been discounted.
          Tune them now and they take effect the day the remote bill path
          ships.
        </span>
      </p>

      {/* Platform default/fallback cap — place monthly_promo_cap is bill SoT. */}
      <SectionCard
        icon={<Coins className="text-secondary h-4 w-4" />}
        title="Default discount cap"
        subtitle="Fallback when a place has not picked its own cap. Applies to both contexts."
      >
        <div className="mt-5 flex flex-wrap items-center gap-2">
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
          of the bill. Example: 50% off a MX$700 bill touches that first MX$
          {cfg.cap.toLocaleString("en-US")}, so the guest saves MX$
          {Math.round(Math.min(700, cfg.cap) * 0.5)}.
        </p>
      </SectionCard>

      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            The live engine pays the visits ladder additively — base + Welcome
            + every earned bonus, clamped and capped. Class is granted, never
            sold; who holds the top rung is decided in{" "}
            <Link href="/aura-consumers" className="underline underline-offset-2">
              Aura Consumers
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={resetDefaults}
            disabled={pending}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            Launch defaults
          </button>
        </div>
        <SaveRow
          pending={pending}
          dirty={dirty}
          ok={ok}
          onClick={save}
          loadError={loadBlocked ? (error ?? "Failed to load Promos config") : null}
        />
        {error && <ErrorNote message={error} />}
      </div>
    </div>
  );
}

/** Parked-but-present marker — the Ojo Config convention. */
function SoonPill() {
  return (
    <span className="border-border text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[0.1em] uppercase">
      Soon
    </span>
  );
}

function BonusList({
  bonuses,
  disabled,
  contextLabel,
  onChange,
}: {
  bonuses: Record<BonusKey, number>;
  disabled: boolean;
  contextLabel: string;
  onChange: (key: BonusKey, value: number) => void;
}) {
  const automatic = BONUS_KEYS.filter((k) => BONUS_META[k].group === "automatic");
  const actions = BONUS_KEYS.filter((k) => BONUS_META[k].group === "action");
  return (
    <div className="mt-4">
      <p className="text-muted-foreground pt-1 pb-1 text-[10px] font-bold tracking-[0.12em] uppercase">
        Automatic bonus
      </p>
      {automatic.map((k) => (
        <BonusRow
          key={k}
          label={BONUS_META[k].name}
          emoji={BONUS_META[k].emoji}
          qualifier={BONUS_META[k].qualifier}
          disabled={disabled}
        >
          <RateSelect
            value={bonuses[k]}
            disabled={disabled}
            ariaLabel={`${BONUS_META[k].name} ${contextLabel} bonus`}
            onChange={(v) => onChange(k, v)}
          />
        </BonusRow>
      ))}

      <p className="text-muted-foreground pt-4 pb-1 text-[10px] font-bold tracking-[0.12em] uppercase">
        Action bonuses
      </p>
      {actions.map((k) => (
        <BonusRow
          key={k}
          label={BONUS_META[k].name}
          emoji={BONUS_META[k].emoji}
          qualifier={BONUS_META[k].qualifier}
          disabled={disabled}
        >
          <RateSelect
            value={bonuses[k]}
            disabled={disabled}
            ariaLabel={`${BONUS_META[k].name} ${contextLabel} bonus`}
            onChange={(v) => onChange(k, v)}
          />
        </BonusRow>
      ))}
    </div>
  );
}

function BonusRow({
  label,
  emoji,
  qualifier,
  disabled,
  children,
}: {
  label: string;
  emoji?: string;
  qualifier: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "border-border/60 flex items-center justify-between gap-4 border-b py-2 last:border-0" +
        (disabled ? " opacity-60" : "")
      }
    >
      <div className="min-w-0">
        <p className="text-foreground text-[13px] font-semibold">
          {emoji ? (
            <span className="mr-1.5" aria-hidden>
              {emoji}
            </span>
          ) : null}
          {label}
        </p>
        <p className="text-muted-foreground truncate text-[11px]">{qualifier}</p>
      </div>
      {children}
    </div>
  );
}

function RateSelect({
  value,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: number;
  disabled: boolean;
  ariaLabel: string;
  onChange: (v: number) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={ariaLabel}
      className="border-border bg-card focus:border-foreground h-9 w-24 rounded-lg border px-1.5 text-center text-[13px] font-semibold tabular-nums outline-none disabled:opacity-50"
    >
      {ALLOWED_RATES.map((r) => (
        <option key={r} value={r}>
          {r <= 0 ? "Off" : `${r}%`}
        </option>
      ))}
    </select>
  );
}
