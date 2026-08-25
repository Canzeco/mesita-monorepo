"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Compass, Layers } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import { Collapsible, SaveRow, SectionCard, Switch } from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  ENGINES,
  SIGNALS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  weightMeaning,
  type DiscoveryConfig,
  type SignalKey,
  type WiredEngineKey,
} from "./catalog";

/** Matches the two-decimal rounding in catalog.coerceConfig. */
const STEP = 0.05;

const INPUT =
  "border-border bg-card focus:border-foreground h-8 w-16 shrink-0 rounded-lg border px-2 text-right text-sm tabular-nums outline-none disabled:opacity-50";

function CalledApis({ apis }: { apis: string[] }) {
  const names = apis.length > 0 ? apis : ["None"];
  return (
    <p className="mt-1 type-label leading-snug">
      {names.map((name, i) => (
        <span key={name}>
          {i > 0 ? " · " : null}
          <strong>{name}</strong>
        </span>
      ))}
    </p>
  );
}

function Enforced({ on }: { on: string }) {
  return (
    <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 type-meta font-semibold tracking-wide uppercase">
      Enforced · {on}
    </span>
  );
}

function ParamInput({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground type-label font-mono">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
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

  const setParam = (
    key: SignalKey,
    field: string,
    value: number,
    min: number,
    max: number,
    step: number,
  ) => {
    const clamped = Math.min(max, Math.max(min, value));
    const decimals = step >= 1 ? 0 : step >= 0.5 ? 1 : 2;
    const rounded = Math.round(clamped * 10 ** decimals) / 10 ** decimals;
    setCfg((c) => ({
      ...c,
      params: {
        ...c.params,
        [key]: { ...c.params[key], [field]: rounded },
      },
    }));
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
        subtitle="Six functions. Engine(signal(), …) reads these. One table for every hyperparameter."
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
          <table className="w-full min-w-[56rem] border-separate border-spacing-0 px-4 sm:px-0">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="w-28 pb-2 pl-1 font-medium">Function</th>
                <th className="pb-2 font-medium">Input</th>
                <th className="pb-2 font-medium">Process</th>
                <th className="pb-2 font-medium">Output</th>
                <th className="w-52 pb-2 pr-1 font-medium">Params</th>
              </tr>
            </thead>
            <tbody>
              {SIGNALS.map((s) => {
                const w = cfg.weights[s.key];
                const off = w <= 0;
                return (
                  <tr
                    key={s.key}
                    className="border-border/50 align-top [&>td]:border-t [&>td]:py-3"
                  >
                    <td className="pl-1 pr-3">
                      <div
                        className={"font-mono text-sm font-semibold" + (off ? " opacity-50" : "")}
                      >
                        {s.fn}
                      </div>
                      <CalledApis apis={s.apis} />
                    </td>
                    <td className="text-muted-foreground max-w-[12rem] pr-3 type-label leading-relaxed">
                      {s.input}
                    </td>
                    <td className="text-muted-foreground type-label max-w-[16rem] pr-3 font-mono leading-relaxed">
                      {s.process}
                    </td>
                    <td className="text-muted-foreground max-w-[12rem] pr-3 type-label leading-relaxed">
                      {s.output}
                    </td>
                    <td className="pr-1">
                      <div className="flex flex-col gap-1.5">
                        <ParamInput
                          label="exponent"
                          value={w}
                          min={WEIGHT_MIN}
                          max={WEIGHT_MAX}
                          step={STEP}
                          disabled={pending}
                          onChange={(n) => setWeight(s.key, n)}
                        />
                        <span className="text-muted-foreground type-meta">{weightMeaning(w)}</span>
                        {s.fields.map((f) => (
                          <ParamInput
                            key={f.key}
                            label={f.label}
                            value={cfg.params[s.key]?.[f.key] ?? 0}
                            min={f.min}
                            max={f.max}
                            step={f.step}
                            disabled={pending}
                            onChange={(n) => setParam(s.key, f.key, n, f.min, f.max, f.step)}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {allOff ? (
          <p className="text-muted-foreground mt-3 type-label">
            Every exponent is 0 — the deck falls back to pool order.
          </p>
        ) : null}

        <Collapsible summary="How the blend reads these">
          <p className="text-muted-foreground type-label max-w-2xl leading-relaxed">
            Each signal is a function: indexes in, one number in 0–1 out. The
            engine multiplies s^exponent. Exponent 0 turns the function off.
            Missing intent abstains at 1 and drops out. Promoting is not a
            function here: money never buys a score.
          </p>
        </Collapsible>
      </SectionCard>

      <SectionCard
        icon={<Layers className="text-secondary h-4 w-4" />}
        title="Engines"
        subtitle="Surfaces that call the signals. Only a wired engine has a param."
      >
        <div className="mt-4 -mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[48rem] border-separate border-spacing-0 px-4 sm:px-0">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="w-28 pb-2 pl-1 font-medium">Function</th>
                <th className="w-20 pb-2 font-medium">State</th>
                <th className="pb-2 font-medium">Input</th>
                <th className="pb-2 font-medium">Process</th>
                <th className="pb-2 font-medium">Output</th>
                <th className="w-44 pb-2 pr-1 text-right font-medium">Params</th>
              </tr>
            </thead>
            <tbody>
              {ENGINES.map((e) => {
                const dim = e.state !== "LIVE";
                return (
                  <tr
                    key={e.key}
                    className="border-border/50 align-top [&>td]:border-t [&>td]:py-3"
                  >
                    <td className="pl-1 pr-3">
                      <span
                        className={"font-mono text-sm font-semibold" + (dim ? " opacity-50" : "")}
                      >
                        {e.fn}
                      </span>
                      <CalledApis apis={e.apis} />
                    </td>
                    <td className="pr-3">
                      <span className="text-muted-foreground type-meta font-semibold tracking-wide uppercase">
                        {e.state}
                      </span>
                    </td>
                    <td className="text-muted-foreground max-w-[10rem] pr-3 type-label leading-relaxed">
                      {e.input}
                    </td>
                    <td className="text-muted-foreground max-w-[16rem] pr-3 type-label leading-relaxed">
                      {e.process}
                    </td>
                    <td className="text-muted-foreground max-w-[10rem] pr-3 type-label leading-relaxed">
                      {e.output}
                    </td>
                    <td className="pr-1">
                      {e.wired ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-muted-foreground type-label">
                            ranked · {cfg.engines[e.wired].ranked ? "signals" : "pool"}
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
                          None
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
