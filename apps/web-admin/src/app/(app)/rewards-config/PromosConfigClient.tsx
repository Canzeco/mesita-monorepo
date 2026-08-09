"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Coins, Gift, Info, Percent, RotateCcw } from "lucide-react";

import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import { SaveRow, SectionCard } from "../enricher-config/atlas-ui";
import { getPromosConfig, updatePromosConfig } from "./actions";
import {
  ACTION_KEYS,
  ALLOWED_CAPS,
  ALLOWED_RATES,
  BONUS_META,
  CLASS_KEYS,
  CLASS_META,
  DEFAULT_PROMOS,
  STRATEGY_KEYS,
  STRATEGY_META,
  totalFor,
  type ActionKey,
  type ClassKey,
  type PromosConfig,
  type StrategyKey,
} from "./promos";

// The v10 promos editor (MESITA-991). The 40-cell wall becomes 14 knobs in
// three groups — base matrix, bonuses, default cap — because that IS the
// model: per-action prices don't vary by strategy or class anymore (one
// Influencer story override excepted). The collapsed preview (decision 1A)
// derives every per-action total for verification without re-introducing the
// wall; the example strip narrates one bill so the additive rule stays
// concrete.

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

  const setBase = (strategy: StrategyKey, cls: ClassKey, value: number) => {
    setCfg((c) => ({
      ...c,
      base: { ...c.base, [strategy]: { ...c.base[strategy], [cls]: value } },
    }));
    setOk(false);
  };

  const setBonus = (
    key: keyof PromosConfig["bonuses"],
    value: number | null,
  ) => {
    setCfg((c) => ({ ...c, bonuses: { ...c.bonuses, [key]: value } }));
    setOk(false);
  };

  const setCap = (value: number) => {
    setCfg((c) => ({ ...c, cap: value }));
    setOk(false);
  };

  const resetDefaults = () => {
    setCfg(DEFAULT_PROMOS);
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
  // Aggressive · Premium, first visit, posts a story.
  const example = useMemo(() => {
    const base = cfg.base.aggressive.premium;
    const total = Math.min(
      100,
      base + cfg.bonuses.welcome + cfg.bonuses.story,
    );
    return { base, total };
  }, [cfg]);

  return (
    <div className="space-y-6">
      {seeded && !loadBlocked && (
        <p className="border-border bg-muted/50 text-muted-foreground flex items-start gap-1.5 rounded-lg border px-3 py-2 text-xs">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          These knobs were derived from the old rule table — review them, then
          Save.
        </p>
      )}

      <SectionCard
        icon={<Percent className="text-secondary h-4 w-4" />}
        title="Base reward"
        subtitle="The standing discount every guest gets, by class."
        status={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {formatShortDate(updatedAt)}
            </span>
          ) : null
        }
      >
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="border-border border-b-2">
                <th
                  scope="col"
                  className="text-muted-foreground pb-2 text-left text-[10px] font-bold tracking-[0.12em] uppercase"
                >
                  Class
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
                  {STRATEGY_KEYS.map((s) => (
                    <td key={s} className="px-2 py-1.5 text-center">
                      <RateSelect
                        value={cfg.base[s][cls]}
                        disabled={pending}
                        ariaLabel={`${STRATEGY_META[s].name} ${CLASS_META[cls].name} base reward`}
                        onChange={(v) => setBase(s, cls, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Gift className="text-secondary h-4 w-4" />}
        title="Bonuses"
        subtitle="Added on top of the base — same for every strategy and class, except the one override."
      >
        <div className="mt-4">
          <p className="text-muted-foreground pt-1 pb-1 text-[10px] font-bold tracking-[0.12em] uppercase">
            Automatic bonus
          </p>
          <BonusRow
            label={BONUS_META.welcome.name}
            emoji={BONUS_META.welcome.emoji}
            qualifier={BONUS_META.welcome.qualifier}
            disabled={pending}
          >
            <RateSelect
              value={cfg.bonuses.welcome}
              disabled={pending}
              ariaLabel="Welcome Visit bonus"
              onChange={(v) => setBonus("welcome", v)}
            />
          </BonusRow>

          <p className="text-muted-foreground pt-4 pb-1 text-[10px] font-bold tracking-[0.12em] uppercase">
            Action bonuses
          </p>
          <BonusRow
            label={BONUS_META.mesita.name}
            emoji={BONUS_META.mesita.emoji}
            qualifier={BONUS_META.mesita.qualifier}
            disabled={pending}
          >
            <RateSelect
              value={cfg.bonuses.mesita}
              disabled={pending}
              ariaLabel="Mesita Review bonus"
              onChange={(v) => setBonus("mesita", v)}
            />
          </BonusRow>
          <BonusRow
            label={BONUS_META.story.name}
            emoji={BONUS_META.story.emoji}
            qualifier={BONUS_META.story.qualifier}
            disabled={pending}
          >
            <RateSelect
              value={cfg.bonuses.story}
              disabled={pending}
              ariaLabel="Instagram Story bonus"
              onChange={(v) => setBonus("story", v)}
            />
          </BonusRow>
          <BonusRow
            label={`↳ ${BONUS_META.story_influencer.name}`}
            qualifier={BONUS_META.story_influencer.qualifier}
            indent
            disabled={pending}
          >
            <OverrideSelect
              value={cfg.bonuses.story_influencer}
              disabled={pending}
              ariaLabel="Instagram Story bonus — Influencer override"
              onChange={(v) => setBonus("story_influencer", v)}
            />
          </BonusRow>
          <BonusRow
            label={BONUS_META.google.name}
            emoji={BONUS_META.google.emoji}
            qualifier={BONUS_META.google.qualifier}
            disabled={pending}
          >
            <RateSelect
              value={cfg.bonuses.google}
              disabled={pending}
              ariaLabel="Google Review bonus"
              onChange={(v) => setBonus("google", v)}
            />
          </BonusRow>
        </div>
      </SectionCard>

      {/* Live example — one bill, narrated (recomputes as knobs change). */}
      <div className="border-border bg-muted/40 rounded-xl border px-4 py-3">
        <p className="text-muted-foreground text-[12.5px]">
          Example, live as you edit —{" "}
          <span className="text-foreground font-mono font-semibold tabular-nums">
            ⚡ Aggressive · 💳 Premium, first visit, posts a story →{" "}
            {example.base}% + {cfg.bonuses.welcome}% + {cfg.bonuses.story}% ={" "}
            {example.total}%
          </span>{" "}
          off the first MX${cfg.cap.toLocaleString("en-US")} (default cap).
        </p>
      </div>

      {/* Collapsed totals preview — decision 1A. */}
      <details className="border-border group rounded-xl border">
        <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium select-none">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          Preview all totals
        </summary>
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
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
                  Class
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
                CLASS_KEYS.map((cls, i) => (
                  <tr
                    key={`${s}|${cls}`}
                    className={
                      i === CLASS_KEYS.length - 1
                        ? "border-border border-b-2 last:border-0"
                        : "border-border border-b"
                    }
                  >
                    <th
                      scope="row"
                      className="py-1.5 pr-3 text-left font-bold whitespace-nowrap"
                    >
                      {i === 0
                        ? `${STRATEGY_META[s].emoji} ${STRATEGY_META[s].name}`
                        : ""}
                    </th>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {CLASS_META[cls].name}
                    </td>
                    {ACTION_KEYS.map((a) => (
                      <td
                        key={a}
                        className="py-1.5 text-right font-mono font-semibold tabular-nums"
                      >
                        {Math.min(100, totalFor(cfg, s, cls, a))}%
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
          <p className="text-muted-foreground/80 mt-2 text-[11px] leading-snug">
            Base + that single action. A real bill can stack several bonuses.
          </p>
        </div>
      </details>

      {/* Platform default/fallback cap — place monthly_promo_cap is bill SoT. */}
      <SectionCard
        icon={<Coins className="text-secondary h-4 w-4" />}
        title="Default discount cap"
        subtitle="Fallback when a place has not picked its own cap."
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
            The live engine pays best-of until MESITA-992 ships; every save
            keeps its rules in sync. Who is on Aura is decided in{" "}
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

function BonusRow({
  label,
  emoji,
  qualifier,
  indent,
  disabled,
  children,
}: {
  label: string;
  emoji?: string;
  qualifier: string;
  indent?: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "border-border/60 flex items-center justify-between gap-4 border-b py-2 last:border-0 " +
        (indent ? "pl-5" : "") +
        (disabled ? " opacity-60" : "")
      }
    >
      <div className="min-w-0">
        <p
          className={
            indent
              ? "text-muted-foreground text-[12.5px] font-medium"
              : "text-foreground text-[13px] font-semibold"
          }
        >
          {emoji ? (
            <span className="mr-1.5" aria-hidden>
              {emoji}
            </span>
          ) : null}
          {label}
        </p>
        <p className="text-muted-foreground truncate text-[11px]">
          {qualifier}
        </p>
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

// The Influencer override is TRI-state (decision 2A): "Same as universal"
// (null, inherit), Off (0), or an explicit rate — so "no special treatment"
// can never accidentally zero out influencer stories.
function OverrideSelect({
  value,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: number | null;
  disabled: boolean;
  ariaLabel: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <select
      value={value === null ? "inherit" : String(value)}
      disabled={disabled}
      onChange={(e) =>
        onChange(e.target.value === "inherit" ? null : Number(e.target.value))
      }
      aria-label={ariaLabel}
      className="border-border bg-card focus:border-foreground h-9 w-40 rounded-lg border px-1.5 text-center text-[12.5px] font-medium tabular-nums outline-none disabled:opacity-50"
    >
      <option value="inherit">Same as universal</option>
      {ALLOWED_RATES.map((r) => (
        <option key={r} value={r}>
          {r <= 0 ? "Off" : `${r}%`}
        </option>
      ))}
    </select>
  );
}
