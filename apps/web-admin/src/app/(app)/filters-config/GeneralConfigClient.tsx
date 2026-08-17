"use client";

// Filters Config · General — the law the six surface tabs inherit.
//
// WHOLE-BLOB save like Promos: General AND every surface ship on each write,
// so saving here never drops a surface's overrides. `dirty` gates on loadError
// so a failed read can't overwrite the live singleton (MESITA-737). Every card
// carries a not-wired KnobStatus — the console is the operator's model of the
// product, and a control that persists but changes nothing has to say so next
// to itself.

import { useState, useTransition } from "react";
import { Compass, Gauge, Layers, Ruler, Settings2 } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import {
  KnobStatus,
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
} from "@/components/admin-ui/config";
import { updateFiltersConfig } from "./actions";
import {
  CATEGORY_CAP_CEILING,
  DISTANCE_CEILING_KM,
  DISTANCE_FLOOR_KM,
  MODULE_KEYS,
  MODULE_META,
  RANDOMNESS_CEILING,
  generalWarnings,
  type ContextDefault,
  type FiltersConfig,
  type GeneralFilters,
  type WhenDefault,
} from "./filters";
import {
  KnobRow,
  SegmentedPicker,
  StagedBanner,
  UpdatedStamp,
  WarningsNote,
} from "./ui";

const NOT_WIRED = (
  <KnobStatus
    kind="not-wired"
    reason="the consumer sheet reads its own code defaults"
  />
);

export function GeneralConfigClient({
  initialConfig,
  initialUpdatedAt,
  initialSeeded,
  loadError,
}: {
  initialConfig: FiltersConfig;
  initialUpdatedAt: string | null;
  initialSeeded: boolean;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<FiltersConfig>(initialConfig);
  const [saved, setSaved] = useState<FiltersConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [seeded, setSeeded] = useState(initialSeeded);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const g = cfg.general;
  const warnings = generalWarnings(cfg);

  const patchGeneral = (p: Partial<GeneralFilters>) => {
    setOk(false);
    setCfg((c) => ({ ...c, general: { ...c.general, ...p } }));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await updateFiltersConfig(cfg);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setSeeded(false);
      setOk(true);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <StagedBanner seeded={seeded} />
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<Layers className="h-4 w-4" />}
        title="Modules"
        subtitle="Which of the six controls the Filters sheet has at all. Off here is off everywhere — a surface cannot turn a module the product doesn't have back on."
        status={NOT_WIRED}
      >
        <div className="mt-5 flex flex-col gap-2.5">
          {MODULE_KEYS.map((key) => (
            <KnobRow
              key={key}
              label={MODULE_META[key].label}
              blurb={MODULE_META[key].blurb}
              control={
                <div className="flex justify-end">
                  <Switch
                    on={g.modules[key]}
                    pending={pending}
                    label={`${MODULE_META[key].label} module`}
                    onClick={() =>
                      patchGeneral({
                        modules: { ...g.modules, [key]: !g.modules[key] },
                      })
                    }
                  />
                </div>
              }
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        icon={<Compass className="h-4 w-4" />}
        title="Defaults"
        subtitle="What a fresh sheet opens on. A default that narrows is a filter nobody chose, so the shipped pair is Any + Anytime."
        status={NOT_WIRED}
      >
        <div className="mt-5 flex flex-col gap-2.5">
          <KnobRow
            label="Context"
            blurb="The first cut. Visit narrows to places running a real visit reward; Order is parked and can never be a default."
            control={
              <SegmentedPicker<ContextDefault>
                ariaLabel="Default context"
                value={g.defaults.context}
                disabled={pending}
                options={[
                  { value: "any", label: "Any" },
                  { value: "visit", label: "Visit" },
                ]}
                onChange={(context) =>
                  patchGeneral({ defaults: { ...g.defaults, context } })
                }
              />
            }
          />
          <KnobRow
            label="When"
            blurb="Now excludes every place without an hours table, which is why Anytime is the neutral open."
            control={
              <SegmentedPicker<WhenDefault>
                ariaLabel="Default when"
                value={g.defaults.when}
                disabled={pending}
                options={[
                  { value: "anytime", label: "Anytime" },
                  { value: "now", label: "Now" },
                ]}
                onChange={(when) =>
                  patchGeneral({ defaults: { ...g.defaults, when } })
                }
              />
            }
          />
          <KnobRow
            label="Distance"
            blurb="The radius the sheet opens on. Any means no radius until the guest sets one."
            control={
              <div className="flex items-center gap-2">
                <SegmentedPicker<"any" | "km">
                  ariaLabel="Default distance mode"
                  value={g.defaults.maxKm === null ? "any" : "km"}
                  disabled={pending}
                  options={[
                    { value: "any", label: "Any" },
                    { value: "km", label: "Radius" },
                  ]}
                  onChange={(mode) =>
                    patchGeneral({
                      defaults: {
                        ...g.defaults,
                        maxKm: mode === "any" ? null : g.bounds.distanceMaxKm,
                      },
                    })
                  }
                />
              </div>
            }
            trailing={
              g.defaults.maxKm === null ? "No radius" : `${g.defaults.maxKm} km`
            }
          />
          {g.defaults.maxKm !== null && (
            <NumberField
              icon={<Ruler className="h-4 w-4" />}
              label="Default radius (km)"
              value={g.defaults.maxKm}
              min={DISTANCE_FLOOR_KM}
              max={DISTANCE_CEILING_KM}
              disabled={pending}
              onChange={(maxKm) =>
                patchGeneral({ defaults: { ...g.defaults, maxKm } })
              }
            />
          )}
          <NumberField
            icon={<Gauge className="h-4 w-4" />}
            label="Default Random level — 0 keeps the ranked order, the ceiling is a full shuffle"
            value={g.defaults.randomness}
            min={0}
            max={RANDOMNESS_CEILING}
            disabled={pending}
            onChange={(randomness) =>
              patchGeneral({ defaults: { ...g.defaults, randomness } })
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<Ruler className="h-4 w-4" />}
        title="Bounds"
        subtitle="The range each control may span. A surface override is clamped to these, so this is the one place a knob's ceiling moves."
        status={NOT_WIRED}
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Ruler className="h-4 w-4" />}
            label="Distance floor (km)"
            value={g.bounds.distanceMinKm}
            min={DISTANCE_FLOOR_KM}
            max={DISTANCE_CEILING_KM}
            disabled={pending}
            onChange={(distanceMinKm) =>
              patchGeneral({ bounds: { ...g.bounds, distanceMinKm } })
            }
          />
          <NumberField
            icon={<Ruler className="h-4 w-4" />}
            label="Distance ceiling (km) — the slider's Any end"
            value={g.bounds.distanceMaxKm}
            min={DISTANCE_FLOOR_KM}
            max={DISTANCE_CEILING_KM}
            disabled={pending}
            onChange={(distanceMaxKm) =>
              patchGeneral({ bounds: { ...g.bounds, distanceMaxKm } })
            }
          />
          <NumberField
            icon={<Gauge className="h-4 w-4" />}
            label="Random ceiling — the top level of the slider"
            value={g.bounds.randomnessMax}
            min={0}
            max={RANDOMNESS_CEILING}
            disabled={pending}
            onChange={(randomnessMax) =>
              patchGeneral({ bounds: { ...g.bounds, randomnessMax } })
            }
          />
          <NumberField
            icon={<Settings2 className="h-4 w-4" />}
            label="Category options — how many concrete categories What derives from the catalog"
            value={g.bounds.categoryOptionsCap}
            min={1}
            max={CATEGORY_CAP_CEILING}
            disabled={pending}
            onChange={(categoryOptionsCap) =>
              patchGeneral({ bounds: { ...g.bounds, categoryOptionsCap } })
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<Settings2 className="h-4 w-4" />}
        title="Behavior"
        subtitle="How the filter store itself works, across every surface at once."
        status={NOT_WIRED}
      >
        <div className="mt-5 flex flex-col gap-2.5">
          <KnobRow
            label="One shared store"
            blurb="Narrowing on Swipe narrows Search too. Off would give each surface its own filters — the shape this product deliberately left behind."
            control={
              <div className="flex justify-end">
                <Switch
                  on={g.behavior.sharedStore}
                  pending={pending}
                  label="One shared store"
                  onClick={() =>
                    patchGeneral({
                      behavior: {
                        ...g.behavior,
                        sharedStore: !g.behavior.sharedStore,
                      },
                    })
                  }
                />
              </div>
            }
          />
          <KnobRow
            label="Persist for the session"
            blurb="Filters survive a reload but not a new session. Off means every open starts from the defaults above."
            control={
              <div className="flex justify-end">
                <Switch
                  on={g.behavior.persistSession}
                  pending={pending}
                  label="Persist for the session"
                  onClick={() =>
                    patchGeneral({
                      behavior: {
                        ...g.behavior,
                        persistSession: !g.behavior.persistSession,
                      },
                    })
                  }
                />
              </div>
            }
          />
          <KnobRow
            label="A picked zone seeds its radius"
            blurb="Choosing a neighbourhood applies a tight ring, a city a loose one. Off means picking a place recenters distances but narrows nothing until the guest moves the slider."
            control={
              <div className="flex justify-end">
                <Switch
                  on={g.behavior.zoneSeedsRadius}
                  pending={pending}
                  label="A picked zone seeds its radius"
                  onClick={() =>
                    patchGeneral({
                      behavior: {
                        ...g.behavior,
                        zoneSeedsRadius: !g.behavior.zoneSeedsRadius,
                      },
                    })
                  }
                />
              </div>
            }
          />
        </div>
        <WarningsNote warnings={warnings} />
      </SectionCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SaveRow
          pending={pending}
          dirty={dirty}
          ok={ok}
          onClick={save}
          loadError={loadError}
        />
        <UpdatedStamp at={updatedAt} />
      </div>
    </div>
  );
}
