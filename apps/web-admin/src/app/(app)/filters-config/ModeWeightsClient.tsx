"use client";

// Signal weights, PER MODE — one table, one Save per column (MESITA-1859).
//
// Until now there was one global exponent vector and a mode could only switch
// a signal OFF. It could never say "proximity matters twice as much on the Map
// as it does on Scroll" — which is the whole reason `weightsForMode` exists.
//
// ONE TABLE, NOT THREE CARDS. Under `Π s^w` only the RATIOS WITHIN A MODE mean
// anything, so the vector has to be readable as a vector. Card-shaped lists
// separated by Soon boxes defeat that. Rows are signals, columns are the modes
// that actually rank, and the eye compares down a column.
//
// ONLY THE MODES THAT READ THEM GET A COLUMN. A naive six-by-nine grid would
// be 54 knobs of which about eleven can move an output:
//
//   Scroll (`swipe`)  always ranks. Real.
//   Map               ranks the Google Places scope — the Map's and the
//                     Feed's Google Places rail — through the shared engine.
//                     Real (MESITA-2298).
//   Word              calls weightsForMode too, and gets NO column: its mask
//                     is one signal, so the exponent is a monotone transform
//                     and provably cannot reorder anything.
//   Catalog           ranks on its own profile, not this table.
//   Chat, Favorites   no engine at all; Favorites' mask is empty besides.
//
// THE MASK STAYS OUTER. `modeSignalState` is code law, not data: a masked-off
// or zeroed cell renders a labelled em-dash and stores nothing, so the console
// can never say "off" over a stored number the engine would still multiply.
// Never a disabled `0` — `DISCOVERY_MODE_SIGNAL_ZERO` exists precisely so Map's
// Randomness reads as off rather than as a printed zero.
//
// ONE SAVE PER COLUMN, ON ITS OWN SLICE. `weights` and `params` both ride
// the single `signals` slice, so a per-column save of that slice would
// silently wipe the other column and the params with it — the same
// incident as the three Sources boxes that shared `map` and became
// mapSupers / mapFloors / mapPull. Each column writes `weightsMap` or
// `weightsScroll`, and nothing else.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Compass, RotateCcw, Undo2 } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  Button,
  KnobState,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import {
  getDiscoveryConfig,
  updateDiscoveryConfig,
  type DiscoverySlice,
} from "./actions";
import {
  DEFAULT_WEIGHTS_BY_MODE,
  DISCOVERY_MODE_LABELS,
  SIGNAL_KEYS,
  SIGNALS,
  WEIGHT_MIN,
  WEIGHTED_MODE_KEYS,
  modeSignalState,
  weightMaxFor,
  type DiscoveryConfig,
  type SignalKey,
  type WeightedModeKey,
} from "./catalog";

/**
 * Every column names its reader (config.tsx requires the reason to name who
 * reads it, so the badge stays checkable against the code).
 *
 * Map is `enforced` since MESITA-2298: every Google Places selection — the
 * Map's Google scope and the Feed's Google Places rail — ranks through the
 * shared engine (`scopeWeights("google")` in `_shared/nearby-lineup.ts`),
 * which IS this column. There is no fallback branch any more: when Google
 * returns nothing the scope is empty, never a Mesita set ranked another way.
 * Mesita Selected ranks with the Catalog profile, not with this table.
 */
const COLUMN_READER: Record<
  WeightedModeKey,
  { kind: "enforced"; reason: string }
> = {
  map: {
    kind: "enforced",
    reason: "Ranks the Google Places scope on the Map and the Feed's Google Places rail",
  },
  swipe: {
    kind: "enforced",
    reason: "Ranks every deck",
  },
};

const SLICE: Record<WeightedModeKey, DiscoverySlice> = {
  map: "weightsMap",
  swipe: "weightsScroll",
};

function columnOf(cfg: DiscoveryConfig, mode: WeightedModeKey) {
  return cfg.weightsByMode[mode];
}

function sameColumn(
  a: DiscoveryConfig,
  b: DiscoveryConfig,
  mode: WeightedModeKey,
) {
  return JSON.stringify(columnOf(a, mode)) === JSON.stringify(columnOf(b, mode));
}

export function ModeWeightsClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
  only,
}: {
  initialConfig: DiscoveryConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
  /** Render one mode's weights. Omit to render every mode that ranks. */
  only?: WeightedModeKey;
}) {
  const [cfg, setCfg] = useState<DiscoveryConfig>(initialConfig);
  const [saved, setSaved] = useState<DiscoveryConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [savingMode, setSavingMode] = useState<WeightedModeKey | null>(null);
  const [okMode, setOkMode] = useState<WeightedModeKey | null>(null);
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  const savedRef = useRef(saved);
  // Written in an effect, never during render (the refs lint rule, and the
  // reason behind it: a ref read during render does not re-render anything).
  // Effects flush in declaration order, so this one lands before the seed
  // effect below ever awaits.
  useEffect(() => {
    savedRef.current = saved;
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getDiscoveryConfig();
      if (!active) return;
      if (!r.ok) {
        // SURFACED UNCONDITIONALLY. This used to speak only when the INITIAL
        // load had already failed, so a silent refetch failure left an
        // operator tuning against stale numbers and saving them over live
        // config. Save stays disabled until a read succeeds (MESITA-737).
        setError(r.error);
        setLoadBlocked(true);
        return;
      }
      // A DIRTY COLUMN IS NEVER CLOBBERED. The seed arrives after the page is
      // already interactive, and typing a 2.5 only to watch it revert on its
      // own is how hand-tuned numbers get lost twice.
      setCfg((current) => {
        const next: DiscoveryConfig = {
          ...r.config,
          weightsByMode: { ...r.config.weightsByMode },
        };
        for (const mode of WEIGHTED_MODE_KEYS) {
          if (!sameColumn(current, savedRef.current, mode)) {
            next.weightsByMode[mode] = columnOf(current, mode);
          }
        }
        return next;
      });
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setError(null);
      setLoadBlocked(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const dirty = useMemo(() => {
    const out = {} as Record<WeightedModeKey, boolean>;
    for (const mode of WEIGHTED_MODE_KEYS) {
      out[mode] = !sameColumn(cfg, saved, mode);
    }
    return out;
  }, [cfg, saved]);

  const patch = (mode: WeightedModeKey, key: SignalKey, value: number) => {
    setOkMode(null);
    setCfg((c) => ({
      ...c,
      weightsByMode: {
        ...c.weightsByMode,
        [mode]: { ...columnOf(c, mode), [key]: value },
      },
    }));
  };

  const setColumn = (
    mode: WeightedModeKey,
    column: Record<SignalKey, number>,
  ) => {
    setOkMode(null);
    setCfg((c) => ({
      ...c,
      weightsByMode: { ...c.weightsByMode, [mode]: { ...column } },
    }));
  };

  const save = (mode: WeightedModeKey) => {
    if (loadBlocked) return;
    setError(null);
    setSavingMode(mode);
    const beforeSave = savedRef.current;
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, [SLICE[mode]]);
      setSavingMode(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // The response is the whole blob, so adopting it wholesale would revert
      // the OTHER column's unsaved edits — saving Map must not silently
      // discard what was typed into Scroll. Keep any column still dirty.
      setCfg((current) => {
        const next: DiscoveryConfig = {
          ...r.config,
          weightsByMode: { ...r.config.weightsByMode },
        };
        for (const other of WEIGHTED_MODE_KEYS) {
          if (other === mode) continue;
          if (!sameColumn(current, beforeSave, other)) {
            next.weightsByMode[other] = columnOf(current, other);
          }
        }
        return next;
      });
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setOkMode(mode);
    });
  };

  const columns = only
    ? WEIGHTED_MODE_KEYS.filter((key) => key === only)
    : WEIGHTED_MODE_KEYS;

  return (
    <div id={only ? `s-weights-${only}` : "s-weights"} className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}
      {columns.map((mode) => {
        const modeLabel = DISCOVERY_MODE_LABELS[mode];
        return (
          <SectionCard
            key={mode}
            icon={<Compass className="text-primary h-4 w-4" />}
            title={`${modeLabel} ranking`}
            subtitle="Exponents for the signals this mode actually multiplies. A signal it does not use is not shown. Zero turns a signal off."
            state={
              <KnobState
                kind={COLUMN_READER[mode].kind}
                reason={COLUMN_READER[mode].reason}
              />
            }
          >
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {SIGNAL_KEYS.map((key) => {
                if (modeSignalState(mode, key) !== "on") return null;
                const label = SIGNALS.find((s) => s.key === key)?.label ?? key;
                const max = weightMaxFor(key);
                return (
                  <label key={key} className="flex flex-col gap-2">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={WEIGHT_MIN}
                        max={max}
                        step={0.05}
                        aria-label={`${label} weight · ${modeLabel}`}
                        value={columnOf(cfg, mode)[key]}
                        disabled={pending || loadBlocked}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (Number.isNaN(raw)) return;
                          const n = Math.round(raw * 100) / 100;
                          patch(mode, key, Math.max(WEIGHT_MIN, Math.min(max, n)));
                        }}
                        className="border-border bg-card focus:border-foreground h-9 w-28 rounded-lg border px-3 text-right text-sm tabular-nums outline-none disabled:opacity-50"
                      />
                      <span className="text-muted-foreground type-meta tabular-nums">
                        {WEIGHT_MIN}–{max}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <SaveRow
                pending={pending && savingMode === mode}
                dirty={dirty[mode]}
                ok={okMode === mode}
                onClick={() => save(mode)}
                loadError={loadBlocked ? error : null}
              />
              <span className="mt-5 flex flex-wrap items-center gap-2">
                <Button
                  tone="ghost"
                  size="sm"
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                  disabled={pending || loadBlocked}
                  onClick={() => setColumn(mode, DEFAULT_WEIGHTS_BY_MODE[mode])}
                >
                  Reset to defaults
                </Button>
                {dirty[mode] ? (
                  <Button
                    tone="ghost"
                    size="sm"
                    icon={<Undo2 className="h-3.5 w-3.5" />}
                    disabled={pending || loadBlocked}
                    onClick={() => setColumn(mode, columnOf(saved, mode))}
                  >
                    Revert to saved
                  </Button>
                ) : null}
              </span>
            </div>
            {updatedAt ? (
              <p className="text-muted-foreground mt-4 type-meta">
                Last saved {formatShortDate(updatedAt)}
              </p>
            ) : null}
          </SectionCard>
        );
      })}
    </div>
  );
}
