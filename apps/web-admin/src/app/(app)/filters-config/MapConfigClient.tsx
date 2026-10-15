"use client";

// Map hyperparameters — live. Places scope picks one of THREE NESTED SETS
// (MESITA-2158): Google Places ⊃ Mesita Places ⊃ Mesita Enriched Places.
// Closest N of that set; inner membership paints, it does not add pins.
// Google types live on the Search Sources subpage.
//
// MESITA PLACES IS EVERY READY PROFILE, Created ones included; Mesita
// Enriched Places is the ones an Enrich run completed. The console must
// say which is which: an operator reading "Mesita Places" would otherwise
// price the enriched set at every row in the table, or the reverse.
//
// HOW MANY PINS CAME BACK HERE (Pato, 2026-09-08: "remove filters from
// search. like those filters are controlled in admin console, not in
// consumer app"). It was the guest's question from 2026-08-29 until the
// Search Filters sheet was deleted in MESITA-1699, and the consumer app now
// has nothing to override it with. Its two neighbours from that sheet went
// to Search Sources (the Nearby pull) and Configurations › Atlas.
// `googleFill` here is what decides whether Google rows appear at all.

import { useMemo } from "react";
import { Hash, Map as MapIcon, RefreshCw } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  ChoiceField,
  ChoicePill,
  KnobState,
  SaveRow,
  SectionCard,
} from "@/components/admin-ui/config";
import { useConfigEditor, type ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  DISCOVERY_MODE_SOURCES,
  GOOGLE_PULL_STOPS,
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
        subtitle="Closest N of the selected set. Lineup ranks listed pins only when Google adds none; otherwise distance."
        state={
          <KnobState
            kind="enforced"
            reason="Places Lineup · Map reads the Map mask"
          />
        }
      >
        <ModeSourceChips sources={DISCOVERY_MODE_SOURCES.map} />
        <div className="mt-5">
          <p className="type-label text-muted-foreground mb-1 font-semibold tracking-wide">
            Places sets
          </p>
          <p className="text-muted-foreground mb-1.5 type-meta">
            Three nested sets: Google Places &sup; Mesita Places &sup; Mesita
            Enriched Places. The guest picks one on the Filters sheet, by
            name.
          </p>
          <p className="text-muted-foreground type-meta">
            <span className="text-foreground font-semibold">
              Enrichment gates the inner ring
            </span>{" "}
            — Mesita Places is every listed place whose profile is ready, and
            a Created place there reads ink until an Enrich run completes and
            turns it red. A profile that cannot be shown now is never a
            search source. Absent or unknown scope on the wire resolves to
            Mesita Places.
          </p>
        </div>
        <div className="mt-5">
          <ChoiceField
            icon={<Hash className="mt-0.5 h-4 w-4 shrink-0" />}
            label="How many pins"
            hint="Closest N of the selected set, both lanes and the merged union — max pins is this number, never the sum. It was the guest's question on the Search Filters sheet until that sheet was deleted (MESITA-1699); nothing on the consumer app overrides it now, so an empty-looking map is this number's fault or googleFill's."
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
