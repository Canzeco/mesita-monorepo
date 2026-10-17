"use client";

// Mesita Places Search Signals, in list order: Name, Description, Family,
// Proximity, Timing, Enriched, Popularity, Randomness. Description is on the
// list and has no number or graphic. Weights live on Modes. Every other
// signal draws its graphic, computed by the live function (SignalGraphic).
//
// THE CARDS DO NOT REDRAW THE MATRIX (MESITA-1856). Each card used to carry
// a strip of six unlabelled circles — which modes read this signal — under
// the description. The Matrix table on this same page already draws that
// grid with a header over every column and the signal's name down the side,
// so the strip repeated it without the labels that made it readable.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlignLeft,
  Clock,
  Compass,
  Dices,
  MapPin,
  Sparkles,
  Star,
  Tags,
  Type,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import { KnobState, SaveRow, SectionCard } from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import { SignalGraphic } from "./SignalGraphic";
import {
  SIGNALS,
  type DiscoveryConfig,
  type SignalKey,
} from "./catalog";

const ICONS: Record<SignalKey, typeof MapPin> = {
  name: Type,
  proximity: MapPin,
  timing: Clock,
  category: Tags,
  popularity: Star,
  enriched: Sparkles,
  randomness: Dices,
};

const LISTED = [
  "name",
  "description",
  "category",
  "proximity",
  "timing",
  "enriched",
  "popularity",
  "randomness",
] as const;

type ListedSignal = (typeof LISTED)[number];

function listedIcon(key: ListedSignal) {
  if (key === "description") return AlignLeft;
  return ICONS[key];
}

function listedLabel(key: ListedSignal): string {
  if (key === "description") return "Description";
  return SIGNALS.find((spec) => spec.key === key)?.label ?? key;
}

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

  const dirty = useMemo(
    () => JSON.stringify(cfg.params) !== JSON.stringify(saved.params),
    [cfg.params, saved.params],
  );
  const dirtyRef = useRef(dirty);
  // Written in an effect, never during render (the refs lint rule, and the
  // reason behind it: a ref read during render does not re-render anything).
  // Effects flush in declaration order, so this one lands before the seed
  // effect below ever awaits.
  useEffect(() => {
    dirtyRef.current = dirty;
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getDiscoveryConfig();
      if (!active) return;
      if (!r.ok) {
        // SURFACED UNCONDITIONALLY (MESITA-1859). This used to speak only
        // when the INITIAL load had already failed, so a silent refetch
        // failure left an operator tuning against stale numbers and saving
        // them over live config. Save stays disabled until a read succeeds.
        setError(r.error);
        setLoadBlocked(true);
        return;
      }
      // Never clobber a dirty form with the seed that arrives after the page
      // is already interactive.
      if (!dirtyRef.current) {
        setCfg(r.config);
        setSaved(r.config);
      }
      setUpdatedAt(r.updatedAt);
      setError(null);
      setLoadBlocked(false);
    })();
    return () => {
      active = false;
    };
  }, []);

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
        title="Signals"
        subtitle="Each graphic is computed by the live signal function with the numbers below. A weight belongs to the mode."
        state={
          <KnobState
            kind="enforced"
            reason="These numbers shape the score. They are not weights."
          />
        }
      >
        <div className="mt-5 flex flex-col gap-5">
          {LISTED.map((key) => {
            const spec = key === "description" ? null : SIGNALS.find((item) => item.key === key);
            const Icon = listedIcon(key);
            return (
              <div key={key} className="flex flex-col gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="text-primary h-4 w-4 shrink-0" />
                  {listedLabel(key)}
                </p>
                {spec?.fields.map((field) => (
                  <label key={field.key} className="flex flex-col gap-2">
                    <span className="text-sm font-medium">{field.label}</span>
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
                          field.step < 1
                            ? Math.round(raw * 100) / 100
                            : Math.round(raw);
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
                {spec ? (
                  <SignalGraphic
                    signal={spec.key}
                    maxKm={cfg.params.proximity.maxKm}
                    closedFloor={cfg.params.timing.closedFloor}
                  />
                ) : null}
              </div>
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
