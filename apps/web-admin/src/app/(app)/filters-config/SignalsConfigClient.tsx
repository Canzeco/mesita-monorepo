"use client";

// Mesita Places Search Signals — the seven earned signals every Mesita
// Places source is ranked by (Docs > Discovery 8.3). Sources retrieve;
// Lineup ranks; these are what it reads. Engines do not invent a second
// scale. Mesita Level is the Enriched row now (MESITA-1858): it reads the
// enrichment state and nothing about money.
//
// THE WEIGHTS LEFT THIS CARD (MESITA-1859). It is the SHAPE card now: what
// each signal computes, and the numbers that bend its curve. The exponents
// moved to one signals-by-mode table on Discovery Modes, because there is no
// longer one exponent per signal — there is one per signal PER MODE, and a
// single column of inputs here could not say which mode it meant.
//
// THE CARDS DO NOT REDRAW THE MATRIX (MESITA-1856). Each card used to carry
// a strip of six unlabelled circles — which modes read this signal — under
// the description. The Matrix table on this same page already draws that
// grid with a header over every column and the signal's name down the side,
// so the strip repeated it without the labels that made it readable.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
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
import {
  SIGNAL_KEYS,
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
        title="Signal shape"
        subtitle="Two numbers the lineup reads for every mode that uses them. Max km is how far proximity still scores. Closed floor is how far a closed place is demoted."
        state={
          <KnobState
            kind="enforced"
            reason="Map and Swipe read these shape numbers"
          />
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {SIGNAL_KEYS.map((key) => {
            const spec = SIGNALS.find((s) => s.key === key);
            if (!spec || spec.fields.length === 0) return null;
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
