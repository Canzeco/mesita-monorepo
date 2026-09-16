"use client";

// Mesita Places Search Signals — the nine earned signals every Mesita
// Places source is ranked by (Docs > Discovery 8.3). Sources retrieve;
// Lineup ranks; these are what it reads. Engines do not invent a second
// scale. Mesita Level split into the two binary rows Enriched and Partnered
// (MESITA-1858): one reads the enrichment state, the other reads `plan`.
// Disjoint facts, so no double-count — which is the thing the MESITA-1408
// merge existed to prevent.
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
  BadgeCheck,
  Clock,
  Compass,
  Dices,
  FileText,
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
  LIBRARY_SIGNALS,
  SIGNALS,
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
  enriched: Sparkles,
  partnered: BadgeCheck,
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
      if (dirtyRef.current) {
        setUpdatedAt(r.updatedAt);
        setError(null);
        setLoadBlocked(false);
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
        title="Mesita Places Search Signals"
        subtitle="What each of the nine earned signals computes, and the shape numbers that bend its curve. Each returns one number in [0, 1]. The exponents live in Signal weights by mode, on Discovery Modes."
        state={
          <KnobState
            kind="enforced"
            reason="Lineup · Map · Word · Scroll read these shape numbers"
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
                  </div>
                </div>
                {/* SEVEN OF THE NINE HAVE NO SHAPE NUMBER, and since the
                    weights left this card that means seven cards would
                    otherwise be a heading over an empty box. One sentence
                    says where the number went instead — the same rule the
                    parked mode boxes follow. */}
                {spec.fields.length === 0 ? (
                  <p className="text-muted-foreground/80 mt-3 type-meta">
                    No shape numbers. Its exponent lives in Signal weights by
                    mode, on Discovery Modes.
                  </p>
                ) : (
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
                )}
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
