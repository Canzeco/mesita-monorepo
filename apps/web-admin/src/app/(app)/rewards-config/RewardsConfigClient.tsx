"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Coins, Info, Percent, RotateCcw, Sparkles } from "lucide-react";

import { ErrorNote } from "@/components/ErrorNote";
import { NumberField, SaveRow, SectionCard } from "../enricher-config/atlas-ui";
import { getRewardsConfig, grantAura, updateRewardsConfig } from "./actions";
import {
  ACTION_KEYS,
  ACTION_META,
  ALLOWED_RATES,
  CAP_MAX,
  CAP_MIN,
  CLASS_KEYS,
  CLASS_META,
  DEFAULT_CONFIG,
  EDITABLE_STRATEGIES,
  type ActionKey,
  type ClassKey,
  type GridStrategy,
  type RewardsConfig,
} from "./catalog";

// The editor renders Pato's table VERBATIM (2026-08-03): rows are
// Strategy × Class, columns are None + the four actions. "None" edits the
// standing class rate (`grid`); an action cell edits
// `actions[action][class]` at the row's strategy. The Story column is
// disabled outside the Influencer rows — eligibility is Influencer-only
// (segments v6) and an editable dead cell would imply otherwise.

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

  const setStanding = (cls: ClassKey, strategy: GridStrategy, value: number) => {
    setCfg((c) => ({
      ...c,
      grid: { ...c.grid, [cls]: { ...c.grid[cls], [strategy]: value } },
    }));
    setOk(false);
  };

  const setActionRate = (
    action: ActionKey,
    cls: ClassKey,
    strategy: GridStrategy,
    value: number,
  ) => {
    setCfg((c) => ({
      ...c,
      actions: {
        ...c.actions,
        [action]: {
          ...c.actions[action],
          [cls]: { ...c.actions[action][cls], [strategy]: value },
        },
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
      <SectionCard
        icon={<Percent className="text-secondary h-4 w-4" />}
        title="Rewards table"
        subtitle="Strategy × Class rows, one cell per action — different discount for each item, depending on the tier. None is the standing class discount. Rates snap to the 5% grid (10–50%); 0 = off; Zero strategy is off by definition and has no rows. A guest is paid their single best qualifying cell — never a sum."
        status={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {new Date(updatedAt).toLocaleDateString()}
            </span>
          ) : null
        }
      >
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[860px]">
            {/* Header — the action columns. */}
            <div className="grid grid-cols-[110px_130px_repeat(5,96px)] items-end gap-2 px-1 pb-2">
              <span className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                Strategy
              </span>
              <span className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
                Class
              </span>
              <span className="text-center">
                <span className="text-foreground block text-[12px] font-bold tracking-tight">
                  None
                </span>
                <span className="text-muted-foreground/80 block text-[10px] leading-tight">
                  standing
                </span>
              </span>
              {ACTION_KEYS.map((a) => (
                <span key={a} className="text-center" title={ACTION_META[a].blurb}>
                  <span className="text-foreground block text-[12px] font-bold tracking-tight">
                    {ACTION_META[a].emoji} {ACTION_META[a].name.split(" ")[0]}
                  </span>
                  <span className="text-muted-foreground/80 block truncate text-[10px] leading-tight">
                    {ACTION_META[a].name.split(" ").slice(1).join(" ") || "action"}
                  </span>
                </span>
              ))}
            </div>

            {/* Rows — Strategy × Class, grouped by strategy. */}
            <div className="space-y-3">
              {EDITABLE_STRATEGIES.map((strat) => (
                <div
                  key={strat.key}
                  className="divide-border/60 border-border divide-y rounded-xl border"
                >
                  {CLASS_KEYS.map((cls, i) => (
                    <div
                      key={cls}
                      className="grid grid-cols-[110px_130px_repeat(5,96px)] items-center gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        {i === 0 ? (
                          <>
                            <p className="text-foreground text-[13px] font-bold">
                              {strat.label}
                            </p>
                            <p className="text-muted-foreground truncate text-[10.5px] leading-tight">
                              {strat.blurb}
                            </p>
                          </>
                        ) : null}
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
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

                      {/* None — the standing class rate. */}
                      <RateSelect
                        value={cfg.grid[cls][strat.key]}
                        disabled={pending}
                        onChange={(v) => setStanding(cls, strat.key, v)}
                      />

                      {ACTION_KEYS.map((action) => {
                        // Story eligibility is Influencer-only (segments v6);
                        // an editable cell on other rows would imply the gate
                        // is priceable away. It is not — it changes upstream.
                        const storyLocked =
                          action === "story" && cls !== "influencer";
                        return storyLocked ? (
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
                            value={cfg.actions[action][cls][strat.key]}
                            disabled={pending}
                            onChange={(v) =>
                              setActionRate(action, cls, strat.key, v)
                            }
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
            make it pay. Best-of pays only the highest qualifying cell, so ties
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

      {/* Aura invitations — the invite-only door, admin-granted for launch. */}
      <AuraGrantCard />

      <div>
        <p className="text-muted-foreground text-xs">
          Persisted to <code className="font-mono">app_settings.rewards_config</code>{" "}
          (v13 matrix). This is the operator source of truth for the v7 rewards
          table; the bill engine reads it on every ticket (MESITA-859).
        </p>
        <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
        {error && <ErrorNote message={error} />}
      </div>
    </div>
  );
}

// Minimal honest surface for the Aura door: paste a consumer id, grant or
// revoke. Grant writes aura/'invitation'; revoke recomputes the best remaining
// door server-side (admin-web-grant-class). A richer consumer browser can
// replace this when one exists.
function AuraGrantCard() {
  const [consumerId, setConsumerId] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedId = consumerId.trim();

  const act = (grant: boolean) => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await grantAura(trimmedId, grant);
      if (r.ok) {
        setResult(
          grant
            ? "Granted — the consumer is now Aura (invitation)."
            : `Revoked — the consumer fell back to ${r.classKey} (${r.origin}).`,
        );
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <SectionCard
      icon={<Sparkles className="text-secondary h-4 w-4" />}
      title="Aura invitations"
      subtitle="Aura is invite-only, and for launch the only door is this console. Grant sets aura via the 'invitation' origin; revoke recomputes the consumer's best remaining door (subscription → Premium, 1,000+ followers → Influencer, else Standard)."
    >
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          value={consumerId}
          onChange={(e) => {
            setConsumerId(e.target.value);
            setResult(null);
            setError(null);
          }}
          placeholder="Consumer id (uuid)"
          spellCheck={false}
          className="border-border bg-card focus:border-foreground h-9 w-full max-w-sm rounded-lg border px-3 font-mono text-[12px] outline-none disabled:opacity-50"
          disabled={pending}
        />
        <button
          type="button"
          onClick={() => act(true)}
          disabled={pending || trimmedId.length === 0}
          className="bg-foreground text-background hover:opacity-90 inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          Grant Aura
        </button>
        <button
          type="button"
          onClick={() => act(false)}
          disabled={pending || trimmedId.length === 0}
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-9 items-center rounded-lg border px-3 text-xs font-medium transition disabled:opacity-50"
        >
          Revoke
        </button>
      </div>
      {result && (
        <p className="text-muted-foreground mt-3 text-xs font-medium">{result}</p>
      )}
      {error && <ErrorNote message={error} />}
    </SectionCard>
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
      className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-1.5 text-center text-[13px] font-semibold tabular-nums outline-none disabled:opacity-50"
    >
      {ALLOWED_RATES.map((r) => (
        <option key={r} value={r}>
          {rateLabel(r)}
        </option>
      ))}
    </select>
  );
}
