"use client";

// Map hyperparameters — live. Three closest-N lanes become one catalog
// after dropping overlaps: Partners, then Mesita, then Google. Google
// categories ride the Nearby call only.

import { useEffect, useMemo, useState, useTransition } from "react";
import { BadgeCheck, Globe, Map as MapIcon, Move, Plug, Store } from "lucide-react";
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
  MAP_LANE_COUNT_MAX,
  MAP_RELOAD_MIN_KM_MAX,
  MAP_RELOAD_MIN_KM_MIN,
  NEARBY_TYPE_FIELDS,
  type DiscoveryConfig,
  type GeneralConfig,
  type MapConfig,
  type NearbyTypeKey,
} from "./catalog";
import { DISCOVERY_GENERAL_EVENT } from "./GeneralConfigClient";

export function MapConfigClient({
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

  const dirty = useMemo(
    () => JSON.stringify(cfg.map) !== JSON.stringify(saved.map),
    [cfg.map, saved.map],
  );

  const patch = (p: Partial<MapConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, map: { ...c.map, ...p } }));
  };

  const patchType = (key: NearbyTypeKey, on: boolean) => {
    setOk(false);
    setCfg((c) => ({
      ...c,
      map: { ...c.map, types: { ...c.map.types, [key]: on } },
    }));
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateDiscoveryConfig(cfg, ["map"]);
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

  const map = cfg.map ?? DEFAULT_CONFIG.map;
  const categoryCount = cfg.general?.categoryCount ?? DEFAULT_CONFIG.general.categoryCount;

  return (
    <div id="s-map" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<MapIcon className="text-primary h-4 w-4" />}
        title="Map"
        subtitle="What entities Search looks for. Closest N in each lane, then one catalog after dropping overlaps: Partners, then Mesita, then Google. Partners ⊆ Mesita ⊆ Google. Union 20–40 at defaults. Google categories ride the Nearby call only. 0 on a lane is off."
        status={
          <KnobStatus
            kind="enforced"
            reason="list-places · Search"
          />
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Mesita partners"
            value={map.partnerCount}
            min={0}
            max={MAP_LANE_COUNT_MAX}
            disabled={pending || loadBlocked}
            onChange={(partnerCount) => patch({ partnerCount })}
          />
          <NumberField
            icon={<Store className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Mesita places"
            value={map.mesitaCount}
            min={0}
            max={MAP_LANE_COUNT_MAX}
            disabled={pending || loadBlocked}
            onChange={(mesitaCount) => patch({ mesitaCount })}
          />
          <NumberField
            icon={<Globe className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Google places"
            value={map.googleCount}
            min={0}
            max={MAP_LANE_COUNT_MAX}
            disabled={pending || loadBlocked}
            onChange={(googleCount) => patch({ googleCount })}
          />
          <NumberField
            icon={<Move className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Reload after the camera moves (km)"
            value={map.reloadMinKm}
            min={MAP_RELOAD_MIN_KM_MIN}
            max={MAP_RELOAD_MIN_KM_MAX}
            decimals
            disabled={pending || loadBlocked}
            onChange={(reloadMinKm) => patch({ reloadMinKm })}
          />
        </div>

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
                  on={map.types[field.key]}
                  pending={pending || loadBlocked || !allowed}
                  onClick={() => {
                    if (!allowed) return;
                    patchType(field.key, !map.types[field.key]);
                  }}
                  label={field.label}
                />
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
