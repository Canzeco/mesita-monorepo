"use client";

// Mesita Places Lineup — nine earned signals. Engines call these; they
// do not invent a second scale. Weights and params persist on
// discovery_config. Bought placement is a post-blend slot, not an earned
// s^w, and it is not a row on this table.

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BadgeCheck,
  Clock,
  Compass,
  Dices,
  FileText,
  MapPin,
  Star,
  Tags,
  Type,
  Users,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  KnobStatus,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import { Flag } from "./DiscoveryFlags";
import {
  DISCOVERY_MODE_KEYS,
  DISCOVERY_MODE_LABELS,
  LIBRARY_SIGNALS,
  SIGNALS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  modeSignalState,
  type DiscoveryConfig,
  type SignalKey,
} from "./catalog";

const ICONS: Record<SignalKey, typeof MapPin> = {
  name: Type,
  summary: FileText,
  proximity: MapPin,
  timing: Clock,
  category: Tags,
  popularity: Star,
  partnership: BadgeCheck,
  randomness: Dices,
  social: Users,
};

export function SignalsConfigClient({
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

  const dirty = useMemo(() => {
    return (
      JSON.stringify({
        weights: cfg.weights,
        params: cfg.params,
      }) !==
      JSON.stringify({
        weights: saved.weights,
        params: saved.params,
      })
    );
  }, [cfg.params, cfg.weights, saved.params, saved.weights]);

  const patchWeight = (key: SignalKey, value: number) => {
    setOk(false);
    setCfg((c) => ({ ...c, weights: { ...c.weights, [key]: value } }));
  };

  const patchParam = (key: SignalKey, field: string, value: number) => {
    setOk(false);
    setCfg((c) => ({
      ...c,
      params: { ...c.params, [key]: { ...c.params[key], [field]: value } },
    }));
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, ["signals"]);
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
    <div id="s-lineup" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<Compass className="text-primary h-4 w-4" />}
        title="Mesita Places Lineup"
        subtitle="The ranked Mesita place feed. Nine earned signals, each one number in [0, 1]. Blend is Π s^w. Bought placement never enters this table."
        status={
          <KnobStatus
            kind="enforced"
            reason="Places Lineup · Map · Deep · Swipe read the mode mask"
          />
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {LIBRARY_SIGNALS.map((row) => {
            const spec = SIGNALS.find((s) => s.key === row.key);
            if (!spec) return null;
            const Icon = ICONS[spec.key];
            return (
              <article
                key={spec.key}
                className="border-border bg-background rounded-xl border p-4"
              >
                <div className="flex items-start gap-2">
                  <Icon className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{spec.label}</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {spec.input} {spec.output}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {DISCOVERY_MODE_KEYS.map((mode) => {
                        const state = modeSignalState(mode, spec.key);
                        return (
                          <Flag
                            key={mode}
                            on={state === "on"}
                            zero={state === "zero"}
                            shape="circle"
                            label={`${DISCOVERY_MODE_LABELS[mode]} · ${state}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="flex items-start gap-2 text-sm font-medium leading-snug">
                      <Compass className="mt-0.5 h-4 w-4 shrink-0" />
                      Weight
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={WEIGHT_MIN}
                      max={WEIGHT_MAX}
                      step={0.05}
                      value={cfg.weights[spec.key]}
                      disabled={pending || loadBlocked}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (Number.isNaN(raw)) return;
                        const n = Math.round(raw * 100) / 100;
                        patchWeight(spec.key, Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, n)));
                      }}
                      className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50"
                    />
                  </label>
                  {spec.fields.map((field) => (
                    <label key={field.key} className="flex flex-col gap-2">
                      <span className="flex items-start gap-2 text-sm font-medium leading-snug">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        {field.label}
                      </span>
                      <input
                        type="number"
                        inputMode={field.step < 1 ? "decimal" : "numeric"}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={cfg.params[spec.key][field.key] ?? 0}
                        disabled={pending || loadBlocked}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (Number.isNaN(raw)) return;
                          const n =
                            field.step < 1 ? Math.round(raw * 100) / 100 : Math.round(raw);
                          patchParam(
                            spec.key,
                            field.key,
                            Math.max(field.min, Math.min(field.max, n)),
                          );
                        }}
                        className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50"
                      />
                    </label>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        {updatedAt ? (
          <p className="text-muted-foreground mt-4 type-meta">
            Last saved {formatShortDate(updatedAt)}
          </p>
        ) : null}
        <SaveRow
          pending={pending}
          dirty={dirty}
          ok={ok}
          onClick={save}
          loadError={loadBlocked ? error : null}
        />
      </SectionCard>
    </div>
  );
}
