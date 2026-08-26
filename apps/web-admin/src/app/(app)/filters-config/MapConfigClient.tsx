"use client";

// Map hyperparameters — live. Two queries (Mesita 20 ∪ Nearby 20); these
// knobs decide which of those may appear and which types ride the one call.

import { useEffect, useMemo, useState, useTransition } from "react";
import { Gauge, Map as MapIcon, MessageCircle, Move, Plug, Star } from "lucide-react";
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
  MAP_MIN_POPULARITY_MAX,
  MAP_RELOAD_MIN_KM_MAX,
  MAP_RELOAD_MIN_KM_MIN,
  MIN_RATING_MAX,
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
        subtitle="Which places may appear in Search — guest map, name search, admin Google Search, and Add. Search still returns up to 50 closest admitted places; these knobs do not raise the cap. 0 on a floor is off. Nearby fill is a separate billed call and does not gate name search or Create."
        status={
          <KnobStatus
            kind="enforced"
            reason="list-places · Search · Create"
          />
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Star className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Min Google rating (0 = off)"
            value={map.minRating}
            min={0}
            max={MIN_RATING_MAX}
            decimals
            disabled={pending || loadBlocked}
            onChange={(minRating) => patch({ minRating })}
          />
          <NumberField
            icon={<MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Min Google reviews (listed only; 0 = off)"
            value={map.minReviews}
            min={0}
            max={100_000}
            disabled={pending || loadBlocked}
            onChange={(minReviews) => patch({ minReviews })}
          />
          <NumberField
            icon={<Gauge className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Min popularity score (0 = off)"
            value={map.minPopularity}
            min={0}
            max={MAP_MIN_POPULARITY_MAX}
            decimals
            disabled={pending || loadBlocked}
            onChange={(minPopularity) => patch({ minPopularity })}
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

        <div className="border-border bg-background mt-3 flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Google Nearby fill</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Off skips Nearby even when web Search asks for it. Listed Mesita
              still paints. Enabled types ride one billed Nearby call.
            </p>
          </div>
          <Switch
            on={map.googleFill}
            pending={pending || loadBlocked}
            onClick={() => patch({ googleFill: !map.googleFill })}
            label="Google Nearby fill"
          />
        </div>

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
