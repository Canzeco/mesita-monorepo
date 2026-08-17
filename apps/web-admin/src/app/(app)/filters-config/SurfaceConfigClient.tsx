"use client";

// Filters Config · one consumer surface (Swipe · Catalog · Chat · Social ·
// Map · Search). ONE client drives all six tabs — the surfaces differ in what
// they mean, not in what they configure, so six near-identical files would be
// six places for the same knob to drift.
//
// The tier that matters here is `inherit`: it TRACKS General rather than
// copying it at save time, so a module switched off in General goes off on
// every inheriting surface. The resolved-state card at the bottom is the
// answer to "so what does this screen actually do?", since that answer is
// never on screen in one piece otherwise.
//
// WHOLE-BLOB save: General and every other surface ride along untouched.

import { useState, useTransition } from "react";
import { Compass, Eye, Gauge, Layers, ListFilter, Ruler } from "lucide-react";
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
  DISTANCE_CEILING_KM,
  DISTANCE_FLOOR_KM,
  MODULE_KEYS,
  MODULE_META,
  RANDOMNESS_CEILING,
  RESULT_CAP_CEILING,
  SURFACE_META,
  resolveSurface,
  surfaceWarnings,
  type ContextDefault,
  type FiltersConfig,
  type ModuleToggle,
  type SurfaceFilters,
  type SurfaceKey,
  type WhenDefault,
} from "./filters";
import {
  KnobRow,
  ParkedBadge,
  SegmentedPicker,
  StagedBanner,
  UpdatedStamp,
  WarningsNote,
} from "./ui";

const TOGGLE_OPTIONS = [
  { value: "inherit" as const, label: "Inherit" },
  { value: "on" as const, label: "On" },
  { value: "off" as const, label: "Off" },
];

function inheritCaption(on: boolean): string {
  return on ? "General: on" : "General: off";
}

export function SurfaceConfigClient({
  surfaceKey,
  initialConfig,
  initialUpdatedAt,
  initialSeeded,
  loadError,
}: {
  surfaceKey: SurfaceKey;
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
  const meta = SURFACE_META[surfaceKey];
  const surface = cfg.surfaces[surfaceKey];
  const resolved = resolveSurface(cfg, surfaceKey);
  const warnings = surfaceWarnings(cfg, surfaceKey);

  const status = meta.live ? (
    <KnobStatus
      kind="not-wired"
      reason="the consumer sheet reads its own code defaults"
    />
  ) : (
    <ParkedBadge />
  );

  const patchSurface = (p: Partial<SurfaceFilters>) => {
    setOk(false);
    setCfg((c) => ({
      ...c,
      surfaces: {
        ...c.surfaces,
        [surfaceKey]: { ...c.surfaces[surfaceKey], ...p },
      },
    }));
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

      {!meta.live && (
        <div className="border-border bg-muted/40 rounded-xl border p-3.5">
          <p className="text-xs leading-relaxed">
            <span className="font-semibold">This surface is parked.</span>{" "}
            <span className="text-muted-foreground">{meta.parkedNote}</span>
          </p>
        </div>
      )}

      <SectionCard
        icon={<Eye className="h-4 w-4" />}
        title="Availability"
        subtitle={`Whether ${meta.label} offers a Filters entry point at all. Off hides the trigger; the modules below become unreachable rather than merely hidden.`}
        status={status}
      >
        <div className="mt-5">
          <KnobRow
            label={`Filters on ${meta.label}`}
            blurb={meta.blurb}
            control={
              <div className="flex justify-end">
                <Switch
                  on={surface.enabled}
                  pending={pending}
                  label={`Filters on ${meta.label}`}
                  onClick={() => patchSurface({ enabled: !surface.enabled })}
                />
              </div>
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<Layers className="h-4 w-4" />}
        title="Modules"
        subtitle="Inherit tracks General — flip a module off there and it goes off here too. On and Off pin this surface regardless, except that General's master switch always wins."
        status={status}
      >
        <div className="mt-5 flex flex-col gap-2.5">
          {MODULE_KEYS.map((key) => (
            <KnobRow
              key={key}
              label={MODULE_META[key].label}
              blurb={MODULE_META[key].blurb}
              control={
                <SegmentedPicker<ModuleToggle>
                  ariaLabel={`${MODULE_META[key].label} module on ${meta.label}`}
                  value={surface.modules[key]}
                  disabled={pending}
                  options={TOGGLE_OPTIONS}
                  onChange={(v) =>
                    patchSurface({
                      modules: { ...surface.modules, [key]: v },
                    })
                  }
                />
              }
              trailing={
                surface.modules[key] === "inherit"
                  ? inheritCaption(cfg.general.modules[key])
                  : resolved.modules[key]
                    ? "Shown"
                    : "Hidden"
              }
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        icon={<Compass className="h-4 w-4" />}
        title="Default overrides"
        subtitle="What this surface opens on when it should differ from General. Inherit is the honest default — an override that merely restates General is a value that stops tracking it."
        status={status}
      >
        <div className="mt-5 flex flex-col gap-2.5">
          <KnobRow
            label="Context"
            blurb="Any, or narrow straight to places that reward a visit."
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
                  patchSurface({
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
            blurb="Anytime, or open already restricted to places open right now."
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
                  patchSurface({
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
            blurb="Inherit follows General. Any pins this surface to no radius; Radius pins it to the number below."
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
                  patchSurface({
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
              label={`Radius on ${meta.label} (km)`}
              value={surface.overrides.maxKm}
              min={DISTANCE_FLOOR_KM}
              max={DISTANCE_CEILING_KM}
              disabled={pending}
              onChange={(km) =>
                patchSurface({
                  overrides: { ...surface.overrides, maxKm: km },
                })
              }
            />
          )}
          <KnobRow
            label="Random"
            blurb="Only a deck can be reordered, so this is inert anywhere but Swipe."
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
                  patchSurface({
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
              label={`Random level on ${meta.label}`}
              value={surface.overrides.randomness}
              min={0}
              max={RANDOMNESS_CEILING}
              disabled={pending}
              onChange={(randomness) =>
                patchSurface({
                  overrides: { ...surface.overrides, randomness },
                })
              }
            />
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={<ListFilter className="h-4 w-4" />}
        title="Result cap"
        subtitle="A hard ceiling on how many places this surface renders once the filters have run. No cap means the surface shows everything that survives."
        status={status}
      >
        <div className="mt-5 flex flex-col gap-2.5">
          <KnobRow
            label="Cap results"
            blurb="A deck of forty cards and a map of four hundred pins are different problems; this is where they stop being the same number."
            control={
              <SegmentedPicker<"none" | "cap">
                ariaLabel={`Result cap on ${meta.label}`}
                value={surface.resultCap === null ? "none" : "cap"}
                disabled={pending}
                options={[
                  { value: "none", label: "No cap" },
                  { value: "cap", label: "Cap" },
                ]}
                onChange={(v) =>
                  patchSurface({ resultCap: v === "none" ? null : 50 })
                }
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
              label={`Maximum places on ${meta.label}`}
              value={surface.resultCap}
              min={1}
              max={RESULT_CAP_CEILING}
              disabled={pending}
              onChange={(resultCap) => patchSurface({ resultCap })}
            />
          )}
        </div>
        <WarningsNote warnings={warnings} />
      </SectionCard>

      <SectionCard
        icon={<Eye className="h-4 w-4" />}
        title={`What ${meta.label} resolves to`}
        subtitle="General folded together with the overrides above — the state a guest would actually meet, once something reads this blob."
        status={status}
      >
        <div className="mt-5 flex flex-col gap-3">
          <div className="border-border bg-background rounded-xl border p-4">
            <p className="text-xs font-semibold">Modules shown</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MODULE_KEYS.filter((k) => resolved.modules[k]).map((k) => (
                <span
                  key={k}
                  className="border-border bg-card rounded-full border px-2.5 py-1 text-[11px] font-medium"
                >
                  {MODULE_META[k].label}
                </span>
              ))}
              {MODULE_KEYS.every((k) => !resolved.modules[k]) && (
                <span className="text-muted-foreground text-[11px]">
                  None — the sheet would open empty.
                </span>
              )}
            </div>
          </div>
          <div className="border-border bg-background rounded-xl border p-4">
            <p className="text-xs font-semibold">Opens on</p>
            <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
              {resolved.enabled ? "Filters reachable" : "Filters hidden"} ·
              context {resolved.defaults.context} · {resolved.defaults.when} ·{" "}
              {resolved.defaults.maxKm === null
                ? "any distance"
                : `within ${resolved.defaults.maxKm} km`}{" "}
              · random level {resolved.defaults.randomness} ·{" "}
              {surface.resultCap === null
                ? "no result cap"
                : `at most ${surface.resultCap} places`}
            </p>
          </div>
        </div>
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
