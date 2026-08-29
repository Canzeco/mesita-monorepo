"use client";

// Map hyperparameters — live. Three closest-N lanes become one catalog
// after dropping overlaps: Partners, then Mesita, then Google. Google
// types live on Discovery Modules.

import { useEffect, useMemo, useState, useTransition } from "react";
import { BadgeCheck, Clock, Globe, Map as MapIcon, Move, Store } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  KnobStatus,
  NumberField,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  DEFAULT_CONFIG,
  DISCOVERY_MODE_MODULES,
  MAP_LANE_COUNT_MAX,
  MAP_RELOAD_MIN_KM_MAX,
  MAP_RELOAD_MIN_KM_MIN,
  MAP_RELOAD_MIN_SEC_MAX,
  MAP_RELOAD_MIN_SEC_MIN,
  type DiscoveryConfig,
  type MapConfig,
} from "./catalog";
import { ModeModuleChips } from "./ModeModuleChips";

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
        subtitle="Closest N enter. Listed pins then Lineup, not distance. Google stays distance."
        status={
          <KnobStatus
            kind="enforced"
            reason="Places Lineup · Map reads the Map mask"
          />
        }
      >
        <ModeModuleChips modules={DISCOVERY_MODE_MODULES.map} />
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
          <NumberField
            icon={<Clock className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Reload after waiting (seconds)"
            value={map.reloadMinSec}
            min={MAP_RELOAD_MIN_SEC_MIN}
            max={MAP_RELOAD_MIN_SEC_MAX}
            decimals
            disabled={pending || loadBlocked}
            onChange={(reloadMinSec) => patch({ reloadMinSec })}
          />
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
