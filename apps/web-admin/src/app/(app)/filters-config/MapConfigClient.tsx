"use client";

// Map hyperparameters — live. Places scope picks one nested set
// (Partners ⊂ Mesita Places ⊂ Google Places). Closest N of that set;
// inner membership paints, it does not add pins. Google types live on
// Modules.
//
// THE MAX NUMBER IS ASKED ONCE, ON THE CONSUMER (Pato, 2026-08-29). How
// many is the guest's How many; the operator only decides IF Google may
// be called (Modules › googleFill + types). Never re-add a count knob.

import { useEffect, useMemo, useState, useTransition } from "react";
import { Map as MapIcon, RefreshCw } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  ChoiceField,
  KnobStatus,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  DEFAULT_CONFIG,
  DISCOVERY_MODE_MODULES,
  MAP_RELOAD_PAIRS,
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
        subtitle="Closest N of the selected set. Listed pins then Lineup, not distance. Google stays distance."
        status={
          <KnobStatus
            kind="enforced"
            reason="Places Lineup · Map reads the Map mask"
          />
        }
      >
        <ModeModuleChips modules={DISCOVERY_MODE_MODULES.map} />
        <p className="text-muted-foreground mt-4 type-meta">
          How many pins is the guest&rsquo;s question — the Filters sheet
          asks it, and nothing here overrides the answer.
        </p>
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
