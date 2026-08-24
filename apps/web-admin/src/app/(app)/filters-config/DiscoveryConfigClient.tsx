"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Compass, Filter, Layers, Megaphone } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import { Collapsible, SaveRow, SectionCard, Switch } from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  ENGINES,
  MAX_DISTANCE_KM_MAX,
  MIN_RATING_MAX,
  SIGNALS,
  SLOT_MAX_EVERY_NTH,
  SLOT_MIN_EVERY_NTH,
  WEIGHT_MAX,
  WEIGHT_MIN,
  weightMeaning,
  type DiscoveryConfig,
  type DiscoveryFilters,
  type SignalKey,
  type WiredEngineKey,
} from "./catalog";

/** The exponent step. Matches the two-decimal rounding in catalog.coerceConfig. */
const STEP = 0.05;

const INPUT =
  "border-border bg-card focus:border-foreground h-9 w-20 shrink-0 rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50";

function Enforced({ on }: { on: string }) {
  return (
    <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 type-meta font-semibold tracking-wide uppercase">
      Enforced · {on}
    </span>
  );
}

export function DiscoveryConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: DiscoveryConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<DiscoveryConfig>(initialConfig);
  const [saved, setSaved] = useState<DiscoveryConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  // Re-fetch on mount so a client-side nav shows the live row, not a stale
  // server render. Success clears a failed-load Save block (MESITA-737).
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getDiscoveryConfig();
      if (!active) return;
      if (!r.ok) {
        if (loadBlocked) setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
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

  const setWeight = (key: SignalKey, value: number) => {
    const clamped = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, value));
    setCfg((c) => ({
      ...c,
      weights: { ...c.weights, [key]: Math.round(clamped * 100) / 100 },
    }));
    setOk(false);
  };

  const setSlotting = <K extends keyof DiscoveryConfig["slotting"]>(
    key: K,
    value: DiscoveryConfig["slotting"][K],
  ) => {
    setCfg((c) => ({ ...c, slotting: { ...c.slotting, [key]: value } }));
    setOk(false);
  };

  const setFilter = <K extends keyof DiscoveryFilters>(
    key: K,
    value: DiscoveryFilters[K],
  ) => {
    setCfg((c) => ({ ...c, filters: { ...c.filters, [key]: value } }));
    setOk(false);
  };

  const setEngineRanked = (key: WiredEngineKey, ranked: boolean) => {
    setCfg((c) => ({ ...c, engines: { ...c.engines, [key]: { ranked } } }));
    setOk(false);
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg);
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

  const allOff = SIGNALS.every((s) => cfg.weights[s.key] <= 0);

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<Compass className="text-secondary h-4 w-4" />}
        title="Signals"
        subtitle="Exponents on the earned blend. 0 is off. Ratios between rows are what matter."
        status={
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Enforced on="Swipe" />
            {updatedAt ? (
              <span className="text-muted-foreground text-xs">
                Updated {formatShortDate(updatedAt)}
              </span>
            ) : null}
          </div>
        }
      >
        <div className="mt-4 -mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[28rem] border-separate border-spacing-0 px-4 sm:px-0">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="pb-2 pl-1 font-medium">Signal</th>
                <th className="w-24 pb-2 text-right font-medium">Exponent</th>
                <th className="w-40 pb-2 pr-1 font-medium">Effect</th>
              </tr>
            </thead>
            <tbody>
              {SIGNALS.map((s) => {
                const w = cfg.weights[s.key];
                const off = w <= 0;
                return (
                  <tr
                    key={s.key}
                    className="border-border/50 align-middle [&>td]:border-t [&>td]:py-2.5"
                  >
                    <td className="pl-1 pr-4">
                      <div
                        className={"text-sm font-semibold" + (off ? " opacity-50" : "")}
                        title={s.reads}
                      >
                        {s.label}
                      </div>
                    </td>
                    <td className="pr-4 text-right">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={WEIGHT_MIN}
                        max={WEIGHT_MAX}
                        step={STEP}
                        value={w}
                        disabled={pending}
                        aria-label={`${s.label} exponent`}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (Number.isNaN(raw)) return;
                          setWeight(s.key, raw);
                        }}
                        className={INPUT + " w-full max-w-24"}
                      />
                    </td>
                    <td
                      className={
                        "pr-1 type-label " +
                        (off ? "text-muted-foreground" : "text-foreground")
                      }
                    >
                      {weightMeaning(w)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {allOff ? (
          <p className="text-muted-foreground mt-3 type-label">
            Every signal is off — the deck falls back to pool order.
          </p>
        ) : null}

        <Collapsible summary="How exponents work">
          <p className="text-muted-foreground type-label max-w-2xl leading-relaxed">
            Each signal scores 0–1 and enters as s^w, so a bigger exponent is
            harsher. Missing data abstains at 1 and drops out. Promoting is not
            a row: money buys a slot below, never a score.
          </p>
        </Collapsible>
      </SectionCard>

      <SectionCard
        icon={<Megaphone className="text-secondary h-4 w-4" />}
        title="Bought slots"
        subtitle="Every Nth card is a paid seat. Rank itself is never for sale."
        status={<Enforced on="Swipe" />}
      >
        <div className="mt-4 divide-border border-border divide-y rounded-xl border">
          <div className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm font-medium leading-snug">Give promoting places slots</p>
            <Switch
              label="Give promoting places slots"
              on={cfg.slotting.enabled}
              pending={pending}
              onClick={() => setSlotting("enabled", !cfg.slotting.enabled)}
            />
          </div>
          <label className="flex items-center justify-between gap-4 p-4">
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-snug">
                Slot every N cards
              </span>
              <span className="text-muted-foreground type-label">
                Floor {SLOT_MIN_EVERY_NTH}, so the top of the deck stays earned.
              </span>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={SLOT_MIN_EVERY_NTH}
              max={SLOT_MAX_EVERY_NTH}
              step={1}
              value={cfg.slotting.everyNth}
              disabled={pending || !cfg.slotting.enabled}
              aria-label="Bought slot every N cards"
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (Number.isNaN(raw)) return;
                setSlotting(
                  "everyNth",
                  Math.min(
                    SLOT_MAX_EVERY_NTH,
                    Math.max(SLOT_MIN_EVERY_NTH, Math.round(raw)),
                  ),
                );
              }}
              className={INPUT}
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Filter className="text-secondary h-4 w-4" />}
        title="Filters"
        subtitle="What may enter the pool. A signal demotes; a filter excludes."
        status={<Enforced on="Swipe + Map" />}
      >
        <div className="mt-4 divide-border border-border divide-y rounded-xl border">
          <div className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm font-medium leading-snug">Only fully enriched places</p>
            <Switch
              label="Only fully enriched places"
              on={cfg.filters.requireReady}
              pending={pending}
              onClick={() => setFilter("requireReady", !cfg.filters.requireReady)}
            />
          </div>
          <FilterNumber
            label="Minimum Google rating"
            hint="0 is off. Above 0 also drops unrated places."
            value={cfg.filters.minRating}
            min={0}
            max={MIN_RATING_MAX}
            step={0.1}
            decimals
            pending={pending}
            onChange={(v) =>
              setFilter(
                "minRating",
                Math.round(Math.min(MIN_RATING_MAX, Math.max(0, v)) * 10) / 10,
              )
            }
          />
          <FilterNumber
            label="Minimum Google reviews"
            hint="0 is off. Above 0 also drops places with no reviews."
            value={cfg.filters.minReviews}
            min={0}
            step={1}
            pending={pending}
            onChange={(v) => setFilter("minReviews", Math.max(0, Math.round(v)))}
          />
          <FilterNumber
            label="Hard radius (km)"
            hint="0 is off. Swipe only — Map uses the viewport."
            value={cfg.filters.maxDistanceKm}
            min={0}
            max={MAX_DISTANCE_KM_MAX}
            step={1}
            pending={pending}
            onChange={(v) =>
              setFilter(
                "maxDistanceKm",
                Math.min(MAX_DISTANCE_KM_MAX, Math.max(0, Math.round(v))),
              )
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<Layers className="text-secondary h-4 w-4" />}
        title="Engines"
        subtitle="Surfaces that return places. Only a wired engine gets a ranking switch."
      >
        <div className="mt-4 -mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[22rem] border-separate border-spacing-0 px-4 sm:px-0">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="pb-2 pl-1 font-medium">Engine</th>
                <th className="w-24 pb-2 font-medium">State</th>
                <th className="w-40 pb-2 pr-1 text-right font-medium">Ranked</th>
              </tr>
            </thead>
            <tbody>
              {ENGINES.map((e) => {
                const dim = e.state !== "LIVE";
                return (
                  <tr
                    key={e.key}
                    title={e.what}
                    className="border-border/50 align-middle [&>td]:border-t [&>td]:py-2.5"
                  >
                    <td className="pl-1 pr-4">
                      <span
                        className={"text-sm font-semibold" + (dim ? " opacity-50" : "")}
                      >
                        {e.label}
                      </span>
                    </td>
                    <td className="pr-4">
                      <span className="text-muted-foreground type-meta font-semibold tracking-wide uppercase">
                        {e.state}
                      </span>
                    </td>
                    <td className="pr-1">
                      {e.wired ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-muted-foreground type-label">
                            {cfg.engines[e.wired].ranked ? "Signals" : "Pool"}
                          </span>
                          <Switch
                            label={`${e.label} reads the signals`}
                            on={cfg.engines[e.wired].ranked}
                            pending={pending}
                            onClick={() =>
                              setEngineRanked(e.wired!, !cfg.engines[e.wired!].ranked)
                            }
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground block text-right type-label">
                          Not wired
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loadBlocked ? error : null}
      />
    </div>
  );
}

function FilterNumber({
  label,
  hint,
  value,
  min,
  max,
  step,
  decimals,
  pending,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max?: number;
  step: number;
  decimals?: boolean;
  pending: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 p-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-snug">{label}</span>
        <span className="text-muted-foreground type-label">{hint}</span>
      </span>
      <input
        type="number"
        inputMode={decimals ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={pending}
        aria-label={label}
        onChange={(e) => {
          const raw = Number(e.target.value);
          if (Number.isNaN(raw)) return;
          onChange(raw);
        }}
        className={INPUT}
      />
    </label>
  );
}
