"use client";

// Map hyperparameters — live. The guest picks ONE scope on the Filters
// sheet, by name: Google Places or Mesita Selected (MESITA-2298). One Nearby
// Search (New) call inside `radiusKm`, the nearest `pinCount` of that scope,
// ranked by the Map column. Google types live on the Search Sources subpage.
//
// Internally the three nested sets still describe the data (Google Places ⊃
// Mesita Places ⊃ Mesita Enriched Places); the guest never sees the middle
// ring or the word Enriched. Mesita Selected IS the enriched, ready set
// today.
//
// HOW MANY PINS CAME BACK HERE (Pato, 2026-09-08: "remove filters from
// search. like those filters are controlled in admin console, not in
// consumer app"). It was the guest's question from 2026-08-29 until the
// Search Filters sheet was deleted in MESITA-1699, and the consumer app now
// has nothing to override it with. `radiusKm` is the one Nearby radius, shared
// with the Feed's Google Places and Mesita Selected rails; a guest never sets
// it. `googleFill` here is what decides whether Google rows appear at all.

import { useMemo } from "react";
import { Hash, Map as MapIcon, Radius, RefreshCw } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  ChoiceField,
  ChoicePill,
  KnobState,
  NumberField,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import { useConfigEditor, type ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  DISCOVERY_MODE_SOURCES,
  GOOGLE_PULL_STOPS,
  MAP_RADIUS_KM_MAX,
  MAP_RADIUS_KM_MIN,
  MAP_RELOAD_PAIRS,
  type DiscoveryConfig,
  type MapConfig,
} from "./catalog";
import { ModeSourceChips } from "./ModeSourceChips";

export function MapConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: ConfigSeed<DiscoveryConfig>) {
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, updatedAt, saveWith } =
    useConfigEditor({ initialConfig, initialUpdatedAt, loadError, load: getDiscoveryConfig });

  const dirty = useMemo(
    () => JSON.stringify(cfg.map) !== JSON.stringify(saved.map),
    [cfg.map, saved.map],
  );

  const patch = (p: Partial<MapConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, map: { ...c.map, ...p } }));
  };

  const save = () => saveWith((c) => updateDiscoveryConfig(c, ["map"]));

  const map = cfg.map;

  return (
    <div id="s-map" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<MapIcon className="text-primary h-4 w-4" />}
        title="Map"
        subtitle="One Nearby call inside the radius, the nearest N of the guest's scope, ranked by the Map column."
        state={
          <KnobState
            kind="enforced"
            reason="Discovery engine · Map reads the Map mask; the Feed's Google Places and Mesita Selected rails share the radius"
          />
        }
      >
        <ModeSourceChips sources={DISCOVERY_MODE_SOURCES.map} />
        <div className="mt-5">
          <p className="type-label text-muted-foreground mb-1 font-semibold tracking-wide">
            Scopes
          </p>
          <p className="text-muted-foreground mb-1.5 type-meta">
            Two scopes, and the guest picks one on the Filters sheet, by name:{" "}
            <span className="text-foreground font-semibold">Google Places</span>{" "}
            — every Google place near the guest, a Mesita place winning its own
            Google id — and{" "}
            <span className="text-foreground font-semibold">Mesita Selected</span>{" "}
            — the enriched, ready profiles.
          </p>
          <p className="text-muted-foreground type-meta">
            The word Enriched never reaches a guest. A profile that cannot be
            shown now is never a search source. Absent or unknown scope on the
            wire resolves to Mesita Selected.
          </p>
        </div>
        <div className="mt-5">
          <NumberField
            icon={<Radius className="mt-0.5 h-4 w-4 shrink-0" />}
            label="Radius (km)"
            value={map.radiusKm}
            min={MAP_RADIUS_KM_MIN}
            max={MAP_RADIUS_KM_MAX}
            decimals
            disabled={pending || loadBlocked}
            onChange={(radiusKm) => patch({ radiusKm })}
          />
          <p className="text-muted-foreground mt-1.5 type-meta">
            One circle for the Map and the Feed&apos;s Google Places and Mesita
            Selected rails. Google caps Nearby at {MAP_RADIUS_KM_MAX} km and
            hands back 20 places per call, nearest first; the engine never
            widens. Guests never set it.
          </p>
        </div>
        <div className="mt-5">
          <ChoiceField
            icon={<Hash className="mt-0.5 h-4 w-4 shrink-0" />}
            label="How many pins"
            hint="The nearest N of the guest's scope — max pins is this number. It was the guest's question on the Search Filters sheet until that sheet was deleted (MESITA-1699); nothing on the consumer app overrides it now, so an empty-looking map is this number's, the radius's or googleFill's fault."
          >
            <div className="flex flex-wrap gap-2">
              {GOOGLE_PULL_STOPS.map((stop) => {
                const active = map.pinCount === stop;
                return (
                  <ChoicePill
                    key={stop}
                    active={active}
                    disabled={pending || loadBlocked}
                    onClick={() => patch({ pinCount: stop })}
                  >
                    {stop}
                  </ChoicePill>
                );
              })}
            </div>
          </ChoiceField>
        </div>
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
                  <ChoicePill
                    key={`${pair.km}-${pair.sec}`}
                    active={active}
                    disabled={pending || loadBlocked}
                    onClick={() =>
                      patch({ reloadMinKm: pair.km, reloadMinSec: pair.sec })
                    }
                  >
                    {pair.km} km · {pair.sec}s
                  </ChoicePill>
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
