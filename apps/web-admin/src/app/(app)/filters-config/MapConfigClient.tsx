"use client";

// Map hyperparameters — live. Three closest-N lanes become one catalog:
// Mesita partners, then Mesita not-partners, then not on Mesita. Google
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
  MAP_LANE_COUNT_MAX,
  MAP_RELOAD_MIN_KM_MAX,
  MAP_RELOAD_MIN_KM_MIN,
  NEARBY_TYPE_FIELDS,
  type DiscoveryConfig,
  type MapConfig,
  type NearbyTypeKey,
} from "./catalog";

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

  return (
    <div id="s-map" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<MapIcon className="text-primary h-4 w-4" />}
        title="Map"
        subtitle="What entities Search looks for. Closest N in each lane by Mesita geodistance, then one catalog: Partners, then not-partners, then not on Mesita. Google categories ride the Nearby call only. 0 on a lane is off."
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
            label="Mesita not partners"
            value={map.notPartnerCount}
            min={0}
            max={MAP_LANE_COUNT_MAX}
            disabled={pending || loadBlocked}
            onChange={(notPartnerCount) => patch({ notPartnerCount })}
          />
          <NumberField
            icon={<Globe className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Google places (not on Mesita)"
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
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {NEARBY_TYPE_FIELDS.map((field) => (
            <div
              key={field.key}
              className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Plug className="text-muted-foreground h-4 w-4 shrink-0" />
                <p className="text-sm font-semibold">{field.label}</p>
              </div>
              <Switch
                on={map.types[field.key]}
                pending={pending || loadBlocked}
                onClick={() => patchType(field.key, !map.types[field.key])}
                label={field.label}
              />
            </div>
          ))}
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
