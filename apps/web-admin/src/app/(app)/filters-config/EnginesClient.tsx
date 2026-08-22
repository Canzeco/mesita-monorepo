"use client";

// Discovery · Engines — the surfaces that turn signals into a list of places.
//
// TWO PAGES (Pato, 2026-08-21: "In discover I only want two pages / Signals &
// Engines"). Discovery was General plus seven surface tabs, and the Chat tab
// had four subpages of its own — subpages inside a subpage, which the same
// review banned outright. The two axes were always there in the data model:
// six MODULES (what a guest can express) and seven SURFACES (what answers).
// Signals is the modules, Engines is the surfaces.
//
// Seven surfaces × six cards each would be forty-two cards on one page, so the
// compaction is where the work is:
//
//   • Only the FOUR LIVE engines get a box. Catalog, Chat and Social are
//     parked — configuring an unwired module on a surface that renders nothing
//     is staged twice over, so they collapse to a single line naming them.
//   • Module BLURBS moved to Signals, where the module is defined. Repeating
//     six definitions on every engine is what made this seven long pages.
//   • Everything past "is it on" and "which modules" sits behind ONE
//     disclosure per engine.
//
// STOP RENDERING, NEVER STOP CARRYING: the parked surfaces keep every key they
// had. Save writes the WHOLE blob (`cfg`), so a surface without a box round-
// trips untouched rather than being reset to defaults by the next write.
//
// ONE Save for the page — the old per-tab Save was seven buttons firing the
// identical whole-blob mutation.

import { useState, useTransition } from "react";
import { Compass, Gauge, ListFilter, Ruler } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import {
  Collapsible,
  KnobStatus,
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
} from "@/components/admin-ui/config";
import { updateFiltersConfig } from "./actions";
import {
  DISTANCE_CEILING_KM,
  DISTANCE_FLOOR_KM,
  MODULE_KEYS,
  MODULE_META,
  RANDOMNESS_CEILING,
  RESULT_CAP_CEILING,
  SURFACE_KEYS,
  SURFACE_META,
  resolveSurface,
  searchbarWarnings,
  surfaceWarnings,
  type ContextDefault,
  type FiltersConfig,
  type ModuleToggle,
  type SearchbarFilters,
  type SurfaceFilters,
  type SurfaceKey,
  type WhenDefault,
} from "./filters";
import { SearchbarCard } from "./SearchbarCard";
import {
  KnobRow,
  SegmentedPicker,
  SheetlessBadge,
  StagedBanner,
  UpdatedStamp,
  WarningsNote,
} from "./ui";

const TOGGLE_OPTIONS = [
  { value: "inherit" as const, label: "Inherit" },
  { value: "on" as const, label: "On" },
  { value: "off" as const, label: "Off" },
];

const LIVE_KEYS = SURFACE_KEYS.filter((k) => SURFACE_META[k].live);
const PARKED_KEYS = SURFACE_KEYS.filter((k) => !SURFACE_META[k].live);

export function EnginesClient({
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

  const patchSurface = (key: SurfaceKey, p: Partial<SurfaceFilters>) => {
    setOk(false);
    setCfg((c) => ({
      ...c,
      surfaces: { ...c.surfaces, [key]: { ...c.surfaces[key], ...p } },
    }));
  };

  const patchSearchbar = (p: Partial<SearchbarFilters>) => {
    setOk(false);
    setCfg((c) => ({ ...c, searchbar: { ...c.searchbar, ...p } }));
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

      {LIVE_KEYS.map((key) => (
        <Engine
          key={key}
          surfaceKey={key}
          cfg={cfg}
          pending={pending}
          onPatch={(p) => patchSurface(key, p)}
          onPatchSearchbar={patchSearchbar}
        />
      ))}

      {/* Parked surfaces. Their knobs still round-trip; there is just nothing
          to decide about a surface that renders nothing. */}
      <div className="border-border bg-muted/40 rounded-xl border p-3.5">
        <p className="text-xs leading-relaxed">
          <span className="font-semibold">
            {PARKED_KEYS.map((k) => SURFACE_META[k].label).join(" · ")} are
            parked.
          </span>{" "}
          <span className="text-muted-foreground">
            Settings are kept, not shown — nothing renders them yet.
          </span>
        </p>
      </div>

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

/** One live engine: on/off, its modules, and everything else behind a fold. */
function Engine({
  surfaceKey,
  cfg,
  pending,
  onPatch,
  onPatchSearchbar,
}: {
  surfaceKey: SurfaceKey;
  cfg: FiltersConfig;
  pending: boolean;
  onPatch: (p: Partial<SurfaceFilters>) => void;
  onPatchSearchbar: (p: Partial<SearchbarFilters>) => void;
}) {
  const meta = SURFACE_META[surfaceKey];
  const surface = cfg.surfaces[surfaceKey];
  const resolved = resolveSurface(cfg, surfaceKey);
  const warnings = surfaceWarnings(cfg, surfaceKey);

  // Sheetless outranks not-wired: Favorites has no trigger at all, so "not
  // wired" would understate it.
  const status = !meta.hasSheet ? (
    <SheetlessBadge />
  ) : (
    <KnobStatus
      kind="not-wired"
      reason="the consumer sheet reads its own code defaults"
    />
  );

  return (
    <SectionCard
      icon={<Compass className="h-4 w-4" />}
      title={meta.label}
      subtitle={meta.hasSheet ? undefined : "Live, but it carries no Filters trigger."}
      status={status}
    >
      <div className="border-border bg-background mt-5 flex items-center justify-between gap-4 rounded-xl border p-4">
        <p className="text-sm font-semibold">Filters here</p>
        <Switch
          on={surface.enabled}
          pending={pending}
          label={`Filters on ${meta.label}`}
          onClick={() => onPatch({ enabled: !surface.enabled })}
        />
      </div>

      {/* Modules. No blurbs — a module is defined once, on Signals. */}
      <div className="mt-3 flex flex-col gap-2.5">
        {MODULE_KEYS.map((key) => (
          <KnobRow
            key={key}
            label={MODULE_META[key].label}
            control={
              <SegmentedPicker<ModuleToggle>
                ariaLabel={`${MODULE_META[key].label} on ${meta.label}`}
                value={surface.modules[key]}
                disabled={pending}
                options={TOGGLE_OPTIONS}
                onChange={(v) =>
                  onPatch({ modules: { ...surface.modules, [key]: v } })
                }
              />
            }
            trailing={
              surface.modules[key] === "inherit"
                ? cfg.general.modules[key]
                  ? "General: on"
                  : "General: off"
                : resolved.modules[key]
                  ? "Shown"
                  : "Hidden"
            }
          />
        ))}
      </div>

      <Collapsible summary="Defaults & cap">
        <div className="flex flex-col gap-2.5">
          <KnobRow
            label="Context"
            control={
              <SegmentedPicker<"inherit" | ContextDefault>
                ariaLabel={`Context default on ${meta.label}`}
                value={surface.overrides.context ?? "inherit"}
                disabled={pending}
                options={[
                  { value: "inherit", label: "Inherit" },
                  { value: "any", label: "Any" },
                  { value: "visit", label: "Visit" },
                ]}
                onChange={(v) =>
                  onPatch({
                    overrides: {
                      ...surface.overrides,
                      context: v === "inherit" ? null : v,
                    },
                  })
                }
              />
            }
            trailing={`Resolves to ${resolved.defaults.context}`}
          />
          <KnobRow
            label="When"
            control={
              <SegmentedPicker<"inherit" | WhenDefault>
                ariaLabel={`When default on ${meta.label}`}
                value={surface.overrides.when ?? "inherit"}
                disabled={pending}
                options={[
                  { value: "inherit", label: "Inherit" },
                  { value: "anytime", label: "Anytime" },
                  { value: "now", label: "Now" },
                ]}
                onChange={(v) =>
                  onPatch({
                    overrides: {
                      ...surface.overrides,
                      when: v === "inherit" ? null : v,
                    },
                  })
                }
              />
            }
            trailing={`Resolves to ${resolved.defaults.when}`}
          />
          <KnobRow
            label="Distance"
            control={
              <SegmentedPicker<"inherit" | "any" | "km">
                ariaLabel={`Distance default on ${meta.label}`}
                value={
                  surface.overrides.maxKm === null
                    ? "inherit"
                    : surface.overrides.maxKm === "any"
                      ? "any"
                      : "km"
                }
                disabled={pending}
                options={[
                  { value: "inherit", label: "Inherit" },
                  { value: "any", label: "Any" },
                  { value: "km", label: "Radius" },
                ]}
                onChange={(v) =>
                  onPatch({
                    overrides: {
                      ...surface.overrides,
                      maxKm:
                        v === "inherit"
                          ? null
                          : v === "any"
                            ? "any"
                            : cfg.general.bounds.distanceMaxKm,
                    },
                  })
                }
              />
            }
            trailing={
              resolved.defaults.maxKm === null
                ? "Resolves to no radius"
                : `Resolves to ${resolved.defaults.maxKm} km`
            }
          />
          {typeof surface.overrides.maxKm === "number" && (
            <NumberField
              icon={<Ruler className="h-4 w-4" />}
              label="Radius (km)"
              value={surface.overrides.maxKm}
              min={DISTANCE_FLOOR_KM}
              max={DISTANCE_CEILING_KM}
              disabled={pending}
              onChange={(km) =>
                onPatch({ overrides: { ...surface.overrides, maxKm: km } })
              }
            />
          )}
          <KnobRow
            label="Random"
            control={
              <SegmentedPicker<"inherit" | "pin">
                ariaLabel={`Random default on ${meta.label}`}
                value={surface.overrides.randomness === null ? "inherit" : "pin"}
                disabled={pending}
                options={[
                  { value: "inherit", label: "Inherit" },
                  { value: "pin", label: "Pin a level" },
                ]}
                onChange={(v) =>
                  onPatch({
                    overrides: {
                      ...surface.overrides,
                      randomness: v === "inherit" ? null : 0,
                    },
                  })
                }
              />
            }
            trailing={`Resolves to level ${resolved.defaults.randomness}`}
          />
          {surface.overrides.randomness !== null && (
            <NumberField
              icon={<Gauge className="h-4 w-4" />}
              label="Random level"
              value={surface.overrides.randomness}
              min={0}
              max={RANDOMNESS_CEILING}
              disabled={pending}
              onChange={(randomness) =>
                onPatch({ overrides: { ...surface.overrides, randomness } })
              }
            />
          )}
          <KnobRow
            label="Result cap"
            control={
              <SegmentedPicker<"none" | "cap">
                ariaLabel={`Result cap on ${meta.label}`}
                value={surface.resultCap === null ? "none" : "cap"}
                disabled={pending}
                options={[
                  { value: "none", label: "No cap" },
                  { value: "cap", label: "Cap" },
                ]}
                onChange={(v) => onPatch({ resultCap: v === "none" ? null : 50 })}
              />
            }
            trailing={
              surface.resultCap === null
                ? "Everything that survives"
                : `${surface.resultCap} places`
            }
          />
          {surface.resultCap !== null && (
            <NumberField
              icon={<ListFilter className="h-4 w-4" />}
              label="Maximum places"
              value={surface.resultCap}
              min={1}
              max={RESULT_CAP_CEILING}
              disabled={pending}
              onChange={(resultCap) => onPatch({ resultCap })}
            />
          )}

          <div className="border-border bg-background rounded-xl border p-4">
            <p className="text-xs font-semibold">Opens on</p>
            <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
              {resolved.enabled ? "Filters reachable" : "Filters hidden"} ·{" "}
              {MODULE_KEYS.filter((k) => resolved.modules[k])
                .map((k) => MODULE_META[k].label)
                .join(", ") || "no modules"}{" "}
              · context {resolved.defaults.context} · {resolved.defaults.when} ·{" "}
              {resolved.defaults.maxKm === null
                ? "any distance"
                : `within ${resolved.defaults.maxKm} km`}{" "}
              · random {resolved.defaults.randomness}
            </p>
          </div>
        </div>
        <WarningsNote warnings={warnings} />
      </Collapsible>

      {surfaceKey === "search" && (
        <div className="mt-3">
          <SearchbarCard
            value={cfg.searchbar}
            onChange={onPatchSearchbar}
            pending={pending}
            status={status}
            warnings={searchbarWarnings(cfg)}
          />
        </div>
      )}
    </SectionCard>
  );
}
