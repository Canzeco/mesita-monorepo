"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Coins, Info, Percent, RotateCcw } from "lucide-react";

import { ErrorNote } from "@/components/ErrorNote";
import { SaveRow, SectionCard } from "../enricher-config/atlas-ui";
import { getRewardsConfig, updateRewardsConfig } from "./actions";
import {
  ACTION_KEYS,
  ACTION_META,
  ALLOWED_CAPS,
  ALLOWED_RATES,
  CLASS_KEYS,
  CLASS_META,
  DEFAULT_CONFIG,
  RULE_COUNT,
  STRATEGY_KEYS,
  STRATEGY_META,
  ruleKey,
  type ActionKey,
  type ClassKey,
  type RewardsConfig,
  type StrategyKey,
} from "./catalog";

// The v8 rewards editor. STORAGE is normalized — one row per (strategy ×
// class × action) in public.reward_rules, PK on the triple (MESITA-873) — but
// the EDITOR is wide: 12 rows of Strategy × Class, one column per action
// (MESITA-874). Sixty selects in a list is a scroll; sixty in a grid is a
// table you can read across, which is how the pricing decision is actually
// made ("what does Premium get here versus Standard").
//
// The two shapes never fight because the flat rule list is the single source:
// the grid indexes it by the triple, and an edit replaces exactly one rule.
// Adding a future action — TikTok, Referral, Birthday, Spend $X — is rows in
// that table plus one entry in ACTION_KEYS, and a column appears here.
//
// Story stays Influencer-only: the cell renders "—" for the other three
// classes because eligibility is a CLASS GATE, not a price, and an editable
// cell there would imply the gate could be priced away.

const isStoryLocked = (action: ActionKey, cls: ClassKey) =>
  action === "story" && cls !== "influencer";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

// Strategy · Class, then one column per action. Declared once so the header
// and every row can never drift out of alignment.
const GRID_COLS = "grid grid-cols-[130px_120px_repeat(5,96px)]";

// Two-line column headings — the emoji + a short head, then the qualifier.
const ACTION_LABEL: Record<ActionKey, { head: string; sub: string }> = {
  standing: { head: "None", sub: "standing" },
  mesita_review: { head: "Mesita", sub: "Review" },
  story: { head: "Instagram", sub: "Story" },
  welcome: { head: "Welcome", sub: "Visit" },
  review: { head: "Google", sub: "Review" },
};

export function RewardsConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: RewardsConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<RewardsConfig>(initialConfig);
  const [saved, setSaved] = useState<RewardsConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  // Re-fetch on mount so a client-side nav shows the live rows, not a stale
  // server render. On failure keep the initial/default config usable.
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getRewardsConfig();
      if (!active || !r.ok) return;
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setError(null);
    })();
    return () => {
      active = false;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(saved),
    [cfg, saved],
  );

  // Rules are a flat list, so an edit is a one-cell replace keyed by the
  // triple — no nested spreading, which is the whole point of normalizing.
  const rateByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of cfg.rules) {
      map.set(ruleKey(r.strategy, r.class, r.action), r.discount_percent);
    }
    return map;
  }, [cfg.rules]);

  const setRate = (
    strategy: StrategyKey,
    cls: ClassKey,
    action: ActionKey,
    value: number,
  ) => {
    setCfg((c) => ({
      ...c,
      rules: c.rules.map((r) =>
        r.strategy === strategy && r.class === cls && r.action === action
          ? { ...r, discount_percent: value }
          : r,
      ),
    }));
    setOk(false);
  };

  const setCap = (value: number) => {
    setCfg((c) => ({ ...c, cap: value }));
    setOk(false);
  };

  const resetDefaults = () => {
    setCfg(DEFAULT_CONFIG);
    setOk(false);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await updateRewardsConfig(cfg);
      if (r.ok) {
        setSaved(r.config);
        setCfg(r.config);
        setUpdatedAt(r.updatedAt);
        setOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <SectionCard
        icon={<Percent className="text-secondary h-4 w-4" />}
        title="Reward rules"
        subtitle={`Strategy × Class rows, one column per action — ${RULE_COUNT} rules in total. None is the standing class discount. Rates snap to the 5% grid (5–70%); 0 = off. Zero strategy has no rules: it is off by definition. A guest is paid their single best qualifying rule — never a sum.`}
        status={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {new Date(updatedAt).toLocaleDateString()}
            </span>
          ) : null
        }
      >
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[880px]">
            {/* Header — Strategy · Class, then one column per action. */}
            <div className={cx(GRID_COLS, "items-end gap-2 px-3 pb-2")}>
              <span className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                Strategy
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                Class
              </span>
              {ACTION_KEYS.map((a) => (
                <span
                  key={a}
                  className="text-center"
                  title={ACTION_META[a].blurb}
                >
                  <span className="text-foreground block text-[12px] font-bold tracking-tight">
                    {ACTION_META[a].emoji} {ACTION_LABEL[a].head}
                  </span>
                  <span className="text-muted-foreground/80 block truncate text-[10px] leading-tight">
                    {ACTION_LABEL[a].sub}
                  </span>
                </span>
              ))}
            </div>

            <div className="space-y-3">
              {STRATEGY_KEYS.map((strategy) => (
                <div
                  key={strategy}
                  className="divide-border/60 border-border divide-y rounded-xl border"
                >
                  {CLASS_KEYS.map((cls, classIndex) => (
                    <div
                      key={cls}
                      className={cx(GRID_COLS, "items-center gap-2 px-3 py-2")}
                    >
                      {/* Strategy — named once per block. */}
                      <div className="min-w-0">
                        {classIndex === 0 ? (
                          <>
                            <p className="text-foreground text-[13px] leading-tight font-bold">
                              {STRATEGY_META[strategy].emoji}{" "}
                              {STRATEGY_META[strategy].name}
                            </p>
                            <p className="text-muted-foreground truncate text-[10.5px] leading-tight">
                              {STRATEGY_META[strategy].blurb}
                            </p>
                          </>
                        ) : null}
                      </div>

                      {/* Class — one per row. */}
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="text-base" aria-hidden>
                          {CLASS_META[cls].emoji}
                        </span>
                        <span
                          className="text-foreground truncate text-[12.5px] font-semibold"
                          title={CLASS_META[cls].blurb}
                        >
                          {CLASS_META[cls].name}
                        </span>
                      </div>

                      {/* One cell per action. */}
                      {ACTION_KEYS.map((action) => {
                        const value =
                          rateByKey.get(ruleKey(strategy, cls, action)) ?? 0;
                        return isStoryLocked(action, cls) ? (
                          <span
                            key={action}
                            title="Influencer-only — eligibility is a class gate, not a price"
                            className="text-muted-foreground/50 text-center text-[13px] font-semibold"
                          >
                            —
                          </span>
                        ) : (
                          <RateSelect
                            key={action}
                            value={value}
                            disabled={pending}
                            onChange={(v) => setRate(strategy, cls, action, v)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-muted-foreground/80 flex items-start gap-1.5 text-[11px] leading-snug">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Mesita Review launched unpriced (0 everywhere) — price it here to
            make it pay. Best-of pays only the highest qualifying rule, so ties
            are harmless.
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
      </SectionCard>

      {/* Universal cap — a scalar, not a rule. */}
      <SectionCard
        icon={<Coins className="text-secondary h-4 w-4" />}
        title="Universal cap"
        subtitle="Every discount applies only to the first N pesos of the bill — a platform-wide constant, always shown to guests. Bounded, predictable cost."
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
        <p className="text-muted-foreground text-xs">
          Persisted to <code className="font-mono">public.reward_rules</code> —
          one row per (strategy × class × action), which is why a new action is
          rows rather than a schema change (v8, MESITA-873). The bill engine
          reads it on every ticket. This page prices the Aura rows — who is
          actually on Aura is decided in{" "}
          <Link href="/aura-config" className="underline underline-offset-2">
            Aura Config
          </Link>
          .
        </p>
        <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
        {error && <ErrorNote message={error} />}
      </div>
    </div>
  );
}

function RateSelect({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Discount"
      className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-1.5 text-center text-[13px] font-semibold tabular-nums outline-none disabled:opacity-50"
    >
      {ALLOWED_RATES.map((r) => (
        <option key={r} value={r}>
          {r <= 0 ? "Off" : `${r}%`}
        </option>
      ))}
    </select>
  );
}
