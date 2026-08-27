"use client";

// Signals library — one box, six reusable scores. Engines call these;
// they do not invent a second scale. Weights and params persist on
// discovery_config. Promoting is the post-blend slot, not an earned s^w.

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Clock,
  Compass,
  MapPin,
  Megaphone,
  Sparkles,
  Star,
  Tags,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  KnobStatus,
  SaveRow,
  SectionCard,
  Switch,
} from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  LIBRARY_SIGNALS,
  SIGNALS,
  SLOT_MAX_EVERY_NTH,
  SLOT_MIN_EVERY_NTH,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type DiscoveryConfig,
  type SignalKey,
} from "./catalog";

const ICONS: Record<SignalKey | "promoting", typeof MapPin> = {
  proximity: MapPin,
  timing: Clock,
  popularity: Star,
  promoting: Megaphone,
  semantic: Sparkles,
  category: Tags,
  randomness: Sparkles,
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
        slotting: cfg.slotting,
      }) !==
      JSON.stringify({
        weights: saved.weights,
        params: saved.params,
        slotting: saved.slotting,
      })
    );
  }, [cfg.params, cfg.slotting, cfg.weights, saved.params, saved.slotting, saved.weights]);

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

  const patchSlotting = (p: Partial<DiscoveryConfig["slotting"]>) => {
    setOk(false);
    setCfg((c) => ({ ...c, slotting: { ...c.slotting, ...p } }));
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
    <div id="s-signals" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<Compass className="text-primary h-4 w-4" />}
        title="Signals"
        subtitle="Reusable scores. Engines call this library; they do not invent a second scale. Each earned signal returns one number in [0, 1]. Promoting is a post-blend slot — bought placement never enters an earned score."
        status={
          <KnobStatus
            kind="not-wired"
            reason="library · Map reads Popularity params · Swipe keeps its own sum"
          />
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {LIBRARY_SIGNALS.map((row) => {
            if (row.kind === "promoting") {
              return (
                <article
                  key="promoting"
                  className="border-border bg-background rounded-xl border p-4"
                >
                  <div className="flex items-start gap-2">
                    <Megaphone className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Promoting</p>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        After the earned blend, insert a promoting place every N
                        cards. Off leaves the earned order alone. Not a score.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <p className="text-sm font-medium">Slot promoting places</p>
                    <Switch
                      on={cfg.slotting.enabled}
                      pending={pending || loadBlocked}
                      onClick={() => patchSlotting({ enabled: !cfg.slotting.enabled })}
                      label="Slot promoting places"
                    />
                  </div>
                  <div className="mt-3">
                    <label className="flex flex-col gap-2">
                      <span className="flex items-start gap-2 text-sm font-medium leading-snug">
                        <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
                        Every Nth card
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={SLOT_MIN_EVERY_NTH}
                        max={SLOT_MAX_EVERY_NTH}
                        step={1}
                        value={cfg.slotting.everyNth}
                        disabled={pending || loadBlocked || !cfg.slotting.enabled}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (Number.isNaN(raw)) return;
                          patchSlotting({
                            everyNth: Math.max(
                              SLOT_MIN_EVERY_NTH,
                              Math.min(SLOT_MAX_EVERY_NTH, Math.round(raw)),
                            ),
                          });
                        }}
                        className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50"
                      />
                    </label>
                  </div>
                </article>
              );
            }

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
