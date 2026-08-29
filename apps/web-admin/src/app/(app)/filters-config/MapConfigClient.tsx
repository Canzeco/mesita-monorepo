"use client";

// Map hyperparameters — live. Three closest-N lanes become one catalog
// after dropping overlaps: Partners, then Mesita, then Google. Google
// types live on Discovery Modules.

import { useEffect, useMemo, useState, useTransition } from "react";
import { BadgeCheck, Globe, Map as MapIcon, RefreshCw, Store } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  ChoiceField,
  KnobStatus,
  LaneMergeFunnel,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  cascadeLaneCounts,
  DEFAULT_CONFIG,
  DISCOVERY_MODE_MODULES,
  MAP_LANE_COUNT_MAX,
  MAP_RELOAD_PAIRS,
  type DiscoveryConfig,
  type LaneCountKey,
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

  const patchLane = (key: Exclude<LaneCountKey, "count">, value: number) => {
    setOk(false);
    setCfg((c) => {
      const next = cascadeLaneCounts(
        {
          partnerCount: c.map.partnerCount,
          mesitaCount: c.map.mesitaCount,
          googleCount: c.map.googleCount,
        },
        key,
        value,
        MAP_LANE_COUNT_MAX,
      );
      return { ...c, map: { ...c.map, ...next } };
    });
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
        <LaneMergeFunnel
          rule="Then merge. Google ≥ Mesita ≥ Partners."
          min={0}
          max={MAP_LANE_COUNT_MAX}
          disabled={pending || loadBlocked}
          bring={[
            {
              key: "google",
              label: "Google places",
              icon: <Globe className="h-4 w-4 shrink-0" />,
              value: map.googleCount,
              onChange: (googleCount) => patchLane("googleCount", googleCount),
            },
            {
              key: "mesita",
              label: "Mesita places",
              icon: <Store className="h-4 w-4 shrink-0" />,
              value: map.mesitaCount,
              onChange: (mesitaCount) => patchLane("mesitaCount", mesitaCount),
            },
            {
              key: "partners",
              label: "Mesita partners",
              icon: <BadgeCheck className="h-4 w-4 shrink-0" />,
              value: map.partnerCount,
              onChange: (partnerCount) => patchLane("partnerCount", partnerCount),
            },
          ]}
        />
        <div className="mt-5">
          <ChoiceField
            icon={<RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Reload after"
            hint="Camera must move this far AND wait this long. Only dragging the map counts — rail or pin taps do not."
          >
            <div className="flex flex-wrap gap-2">
              {MAP_RELOAD_PAIRS.map((pair) => {
                const active =
                  map.reloadMinKm === pair.km && map.reloadMinSec === pair.sec;
                return (
                  <button
                    key={`${pair.km}-${pair.sec}`}
                    type="button"
                    disabled={pending || loadBlocked}
                    onClick={() =>
                      patch({ reloadMinKm: pair.km, reloadMinSec: pair.sec })
                    }
                    aria-pressed={active}
                    className={
                      active
                        ? "bg-foreground text-background inline-flex h-9 items-center rounded-lg px-3.5 type-body font-bold tabular-nums transition disabled:opacity-50"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-9 items-center rounded-lg border px-3.5 type-body font-semibold tabular-nums transition disabled:opacity-50"
                    }
                  >
                    {pair.km} km · {pair.sec}s
                  </button>
                );
              })}
            </div>
          </ChoiceField>
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
