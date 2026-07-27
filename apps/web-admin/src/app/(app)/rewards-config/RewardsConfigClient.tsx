"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Coins, Info, Percent, RotateCcw } from "lucide-react";

import { ErrorNote } from "@/components/ErrorNote";
import { NumberField, SaveRow, SectionCard } from "../enricher-config/atlas-ui";
import { getRewardsConfig, updateRewardsConfig } from "./actions";
import {
  ALLOWED_RATES,
  CAP_MAX,
  CAP_MIN,
  DEFAULT_CONFIG,
  STRATEGY_IDS,
  SEGMENTS,
  type GridStrategy,
  type RewardSegmentKey,
  type RewardsConfig,
} from "./catalog";

const KIND_TINT: Record<string, string> = {
  class: "bg-violet-500/10 text-violet-600",
  action: "bg-sky-500/10 text-sky-600",
  visit: "bg-amber-500/10 text-amber-600",
};

function rateLabel(v: number): string {
  return v <= 0 ? "Off" : `${v}%`;
}

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

  // Re-fetch on mount so a client-side nav shows the live row, not a stale
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

  const setRate = (
    seg: RewardSegmentKey,
    strategy: GridStrategy,
    value: number,
  ) => {
    setCfg((c) => ({
      ...c,
      grid: {
        ...c.grid,
        [seg]: { ...c.grid[seg], [strategy]: value },
      },
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
      {/* The grid — six segments (rows) × three strategies (columns). */}
      <SectionCard
        icon={<Percent className="text-secondary h-4 w-4" />}
        title="Reward grid"
        subtitle="For each strategy a place can pick, set what every segment pays. Rates snap to the 5% grid (10–50%); Zero is off by definition. A guest is paid their single best qualifying rung — never a sum."
        status={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {new Date(updatedAt).toLocaleDateString()}
            </span>
          ) : null
        }
      >
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[560px]">
            {/* Header — strategy columns. */}
            <div className="grid grid-cols-[minmax(150px,1fr)_repeat(3,104px)] items-end gap-2 px-1 pb-2">
              <span className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                Segment
              </span>
              {STRATEGY_IDS.map((p) => (
                <span key={p.key} className="text-center">
                  <span className="text-foreground block text-[13px] font-bold tracking-tight">
                    {p.label}
                  </span>
                  <span className="text-muted-foreground/80 block text-[10px] leading-tight">
                    {p.editable ? "editable" : "always off"}
                  </span>
                </span>
              ))}
            </div>

            {/* Rows — ladder order, worst→best. */}
            <div className="divide-border/60 border-border divide-y rounded-xl border">
              {SEGMENTS.map((seg) => (
                <div
                  key={seg.key}
                  className="grid grid-cols-[minmax(150px,1fr)_repeat(3,104px)] items-center gap-2 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="bg-muted grid size-8 shrink-0 place-items-center rounded-lg text-base"
                      aria-hidden
                    >
                      {seg.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground flex items-center gap-1.5 text-[13px] font-semibold">
                        <span className="text-muted-foreground/70 tabular-nums text-[11px]">
                          {seg.rank}.
                        </span>
                        <span className="truncate">{seg.name}</span>
                        <span
                          className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold tracking-wide uppercase ${KIND_TINT[seg.kind]}`}
                        >
                          {seg.kind}
                        </span>
                      </p>
                      <p className="text-muted-foreground truncate text-[11px] leading-tight">
                        {seg.blurb}
                      </p>
                    </div>
                  </div>

                  {STRATEGY_IDS.map((p) =>
                    p.editable ? (
                      <RateSelect
                        key={p.key}
                        value={cfg.grid[seg.key][p.key]}
                        disabled={pending}
                        onChange={(v) => setRate(seg.key, p.key, v)}
                      />
                    ) : (
                      <span
                        key={p.key}
                        className="text-muted-foreground/60 text-center text-[13px] font-semibold tabular-nums"
                      >
                        Off
                      </span>
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-muted-foreground/80 flex items-start gap-1.5 text-[11px] leading-snug">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Ties within {"{Magnetic, Premium}"} and {"{Story, Welcome}"} are
            harmless — best-of pays only the highest.
          </p>
          <button
            type="button"
            onClick={resetDefaults}
            disabled={pending}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            v5 defaults
          </button>
        </div>
      </SectionCard>

      {/* Universal cap. */}
      <SectionCard
        icon={<Coins className="text-secondary h-4 w-4" />}
        title="Universal cap"
        subtitle="Every discount applies only to the first N pesos of the bill — a platform-wide constant, always shown to guests. Bounded, predictable cost."
      >
        <div className="mt-5 max-w-xs">
          <NumberField
            icon={<Coins className="text-muted-foreground mt-0.5 h-4 w-4" />}
            label="First MX$N of the bill"
            value={cfg.cap}
            min={CAP_MIN}
            max={CAP_MAX}
            onChange={setCap}
            disabled={pending}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Example: 50% off a MX$700 bill touches the first MX${cfg.cap}, so the
          guest saves MX${Math.round(cfg.cap * 0.5)}.
        </p>
      </SectionCard>

      <div>
        <p className="text-muted-foreground text-xs">
          Persisted to <code className="font-mono">app_settings.rewards_config</code>. This
          is the operator source of truth for the v5 reward grid; the bill engine
          reads it once v5 best-of ships (MESITA-723).
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
      aria-label="Rate"
      className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-2 text-center text-[13px] font-semibold tabular-nums outline-none disabled:opacity-50"
    >
      {ALLOWED_RATES.map((r) => (
        <option key={r} value={r}>
          {rateLabel(r)}
        </option>
      ))}
    </select>
  );
}
