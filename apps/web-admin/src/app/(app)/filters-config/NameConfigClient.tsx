"use client";

// Name hyperparameters — live. Two boxes, one blob (`discovery_config.name`).
// Fast Search is Autocomplete while typing. Deep Search is Partners · Mesita ·
// Google after the guest stops, then one list after dropping overlaps.

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BadgeCheck,
  Globe,
  Layers,
  Plug,
  Search,
  Store,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  KnobStatus,
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
} from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  DEFAULT_CONFIG,
  GENERAL_CATEGORY_COUNT_MAX,
  NAME_LANE_COUNT_MAX,
  NEARBY_TYPE_FIELDS,
  type DiscoveryConfig,
  type GeneralConfig,
  type NameDeepConfig,
  type NameFastConfig,
  type NearbyTypeKey,
} from "./catalog";
import { DISCOVERY_GENERAL_EVENT } from "./GeneralConfigClient";

function TypeBatteries({
  types,
  pending,
  categoryCount,
  onToggle,
}: {
  types: Record<NearbyTypeKey, boolean>;
  pending: boolean;
  categoryCount: number;
  onToggle: (key: NearbyTypeKey, on: boolean) => void;
}) {
  return (
    <>
      <p className="text-muted-foreground mt-5 type-meta font-semibold tracking-wide uppercase">
        Google categories
      </p>
      {categoryCount < GENERAL_CATEGORY_COUNT_MAX ? (
        <p className="text-muted-foreground mt-1 type-meta">
          Types past General › Categories stay saved but unused.
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {NEARBY_TYPE_FIELDS.map((field, i) => {
          const allowed = i < categoryCount;
          return (
            <div
              key={field.key}
              className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Plug className="text-muted-foreground h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{field.label}</p>
                  {!allowed ? (
                    <p className="text-muted-foreground type-meta">Past General count</p>
                  ) : null}
                </div>
              </div>
              <Switch
                on={types[field.key]}
                pending={pending || !allowed}
                onClick={() => {
                  if (!allowed) return;
                  onToggle(field.key, !types[field.key]);
                }}
                label={field.label}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

export function NameConfigClient({
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
  const [okSlice, setOkSlice] = useState<null | "fast" | "deep">(null);
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

  useEffect(() => {
    const on = (e: Event) => {
      const general = (e as CustomEvent<GeneralConfig>).detail;
      if (!general) return;
      setCfg((c) => ({ ...c, general }));
      setSaved((s) => ({ ...s, general }));
    };
    window.addEventListener(DISCOVERY_GENERAL_EVENT, on);
    return () => window.removeEventListener(DISCOVERY_GENERAL_EVENT, on);
  }, []);

  const fastDirty = useMemo(
    () => JSON.stringify(cfg.name.fast) !== JSON.stringify(saved.name.fast),
    [cfg.name.fast, saved.name.fast],
  );
  const deepDirty = useMemo(
    () => JSON.stringify(cfg.name.deep) !== JSON.stringify(saved.name.deep),
    [cfg.name.deep, saved.name.deep],
  );

  const patchFast = (p: Partial<NameFastConfig>) => {
    setOkSlice(null);
    setCfg((c) => ({ ...c, name: { ...c.name, fast: { ...c.name.fast, ...p } } }));
  };

  const patchDeep = (p: Partial<NameDeepConfig>) => {
    setOkSlice(null);
    setCfg((c) => ({ ...c, name: { ...c.name, deep: { ...c.name.deep, ...p } } }));
  };

  const patchFastType = (key: NearbyTypeKey, on: boolean) => {
    setOkSlice(null);
    setCfg((c) => ({
      ...c,
      name: {
        ...c.name,
        fast: { ...c.name.fast, types: { ...c.name.fast.types, [key]: on } },
      },
    }));
  };

  const patchDeepType = (key: NearbyTypeKey, on: boolean) => {
    setOkSlice(null);
    setCfg((c) => ({
      ...c,
      name: {
        ...c.name,
        deep: { ...c.name.deep, types: { ...c.name.deep.types, [key]: on } },
      },
    }));
  };

  const save = (slice: "nameFast" | "nameDeep") => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, [slice]);
      if (r.ok) {
        setSaved(r.config);
        setCfg(r.config);
        setUpdatedAt(r.updatedAt);
        setOkSlice(slice === "nameFast" ? "fast" : "deep");
      } else {
        setError(r.error);
      }
    });
  };

  const name = cfg.name ?? DEFAULT_CONFIG.name;
  const categoryCount = cfg.general?.categoryCount ?? DEFAULT_CONFIG.general.categoryCount;

  return (
    <div className="flex flex-col gap-10">
      {error ? <ErrorNote message={error} /> : null}

      <div id="s-name-fast" className="scroll-mt-16">
        <SectionCard
          icon={<Search className="text-primary h-4 w-4" />}
          title="Fast Search"
          subtitle="Autocomplete while the guest types. Google categories plus a cap. 0 is off."
          status={
            <KnobStatus
              kind="enforced"
              reason="suggest-places · Search"
            />
          }
        >
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <NumberField
              icon={<Layers className="mt-0.5 h-4 w-4 shrink-0" />}
              label="Max results"
              value={name.fast.count}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={pending || loadBlocked}
              onChange={(count) => patchFast({ count })}
            />
          </div>
          <TypeBatteries
            types={name.fast.types}
            pending={pending || loadBlocked}
            categoryCount={categoryCount}
            onToggle={patchFastType}
          />
          {updatedAt ? (
            <p className="text-muted-foreground mt-4 type-meta">
              Last saved {formatShortDate(updatedAt)}
            </p>
          ) : null}
          <SaveRow
            pending={pending}
            dirty={fastDirty}
            ok={okSlice === "fast" && !fastDirty}
            onClick={() => save("nameFast")}
            loadError={loadBlocked ? error : null}
          />
        </SectionCard>
      </div>

      <div id="s-name-deep" className="scroll-mt-16">
        <SectionCard
          icon={<Layers className="text-primary h-4 w-4" />}
          title="Deep Search"
          subtitle="Runs about one second after the guest stops typing. Top N by name similarity for Partners and Mesita, then Google Text Search order. One list after dropping overlaps: Partners, then Mesita, then Google. Google categories ride Text Search only. 0 on a lane is off."
          status={
            <KnobStatus
              kind="enforced"
              reason="suggest-places · Search"
            />
          }
        >
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <NumberField
              icon={<BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />}
              label="Mesita partners"
              value={name.deep.partnerCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={pending || loadBlocked}
              onChange={(partnerCount) => patchDeep({ partnerCount })}
            />
            <NumberField
              icon={<Store className="mt-0.5 h-4 w-4 shrink-0" />}
              label="Mesita places"
              value={name.deep.mesitaCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={pending || loadBlocked}
              onChange={(mesitaCount) => patchDeep({ mesitaCount })}
            />
            <NumberField
              icon={<Globe className="mt-0.5 h-4 w-4 shrink-0" />}
              label="Google places"
              value={name.deep.googleCount}
              min={0}
              max={NAME_LANE_COUNT_MAX}
              disabled={pending || loadBlocked}
              onChange={(googleCount) => patchDeep({ googleCount })}
            />
          </div>
          <TypeBatteries
            types={name.deep.types}
            pending={pending || loadBlocked}
            categoryCount={categoryCount}
            onToggle={patchDeepType}
          />
          {updatedAt ? (
            <p className="text-muted-foreground mt-4 type-meta">
              Last saved {formatShortDate(updatedAt)}
            </p>
          ) : null}
          <SaveRow
            pending={pending}
            dirty={deepDirty}
            ok={okSlice === "deep" && !deepDirty}
            onClick={() => save("nameDeep")}
            loadError={loadBlocked ? error : null}
          />
        </SectionCard>
      </div>
    </div>
  );
}
