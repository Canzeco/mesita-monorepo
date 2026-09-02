import { LayoutGrid } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/config";
import { Flag, Square } from "./DiscoveryFlags";
import {
  DISCOVERY_ENTITIES,
  DISCOVERY_MODE_KEYS,
  DISCOVERY_MODE_LABELS,
  DISCOVERY_SOURCES,
  DISCOVERY_POOLS,
  LIBRARY_SIGNALS,
  SIGNALS,
  modeCallsSource,
  modeRequiresPool,
  modeReturnsEntity,
  modeSignalState,
} from "./catalog";

// Locked mode × entity × pool × source × signal matrix (Pato, 2026-08-28;
// Result Entities added 2026-09-02; Modules became Sources 2026-09-02).
// Four bands: Result Entities · Places Types · Search Sources · Mesita
// Places Search Signals. The third band names the subpage that configures
// it — the tab followed the band here, not the other way round. Rules separate the bands. Map Randomness is off,
// not a printed 0.
//
// RESULT ENTITIES LEADS because it answers the first question an operator
// asks of a mode — what comes back — and the three bands under it are the
// machinery that produces it. Squares, not the green/red flags: an entity
// is a SET the mode can answer with, the same kind of fact as a pool, while
// green/red means a call fires.

const COLS = 1 + DISCOVERY_MODE_KEYS.length;

function BandRule() {
  return (
    <tr aria-hidden>
      <td colSpan={COLS} className="px-0 py-3">
        <div className="border-border border-t-2" />
        <div className="border-border mt-0.5 border-t" />
      </td>
    </tr>
  );
}

function BandTitle({ title }: { title: string }) {
  return (
    <tr>
      <th
        colSpan={COLS}
        className="text-muted-foreground type-meta font-semibold pb-2 pt-1"
      >
        {title}
      </th>
    </tr>
  );
}

export function DiscoveryMatrix() {
  return (
    <SectionCard
      icon={<LayoutGrid className="text-muted-foreground size-4" />}
      title="Discovery matrix"
      subtitle="Locked. The six modes across the top. Result Entities, Places Types, Search Sources, then the signals that rank them. Chips on the cards below repeat the green sources."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <thead>
            <tr className="border-border border-b">
              <th className="text-muted-foreground type-meta font-semibold pr-3 py-2">
                Discovery
              </th>
              {DISCOVERY_MODE_KEYS.map((mode) => (
                <th
                  key={mode}
                  className="text-muted-foreground type-meta font-semibold px-1.5 py-2 text-center"
                >
                  {DISCOVERY_MODE_LABELS[mode]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <BandTitle title="Result Entities" />
            {DISCOVERY_ENTITIES.map((entity) => (
              <tr key={entity.key} className="border-border/60 border-b">
                <th className="type-label font-medium pr-3 py-2">
                  {entity.label}
                </th>
                {DISCOVERY_MODE_KEYS.map((mode) => {
                  const on = modeReturnsEntity(mode, entity.key);
                  return (
                    <td key={mode} className="px-1.5 py-2 text-center">
                      <Square
                        on={on}
                        label={`${entity.label} · ${DISCOVERY_MODE_LABELS[mode]} · ${on ? "returned" : "not returned"}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            <BandRule />
            <BandTitle title="Places Types" />
            {DISCOVERY_POOLS.map((pool) => (
              <tr key={pool.key} className="border-border/60 border-b">
                <th className="type-label font-medium pr-3 py-2">{pool.label}</th>
                {DISCOVERY_MODE_KEYS.map((mode) => {
                  const on = modeRequiresPool(mode, pool.key);
                  return (
                    <td key={mode} className="px-1.5 py-2 text-center">
                      <Square
                        on={on}
                        label={`${pool.label} · ${DISCOVERY_MODE_LABELS[mode]} · ${on ? "required" : "not required"}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            <BandRule />
            <BandTitle title="Search Sources" />
            {DISCOVERY_SOURCES.map((source) => (
              <tr key={source} className="border-border/60 border-b">
                <th className="type-label font-medium pr-3 py-2">{source}</th>
                {DISCOVERY_MODE_KEYS.map((mode) => {
                  const on = modeCallsSource(mode, source);
                  return (
                    <td key={mode} className="px-1.5 py-2 text-center">
                      <Flag
                        on={on}
                        shape="square"
                        label={`${source} · ${DISCOVERY_MODE_LABELS[mode]} · ${on ? "on" : "off"}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            <BandRule />
            <BandTitle title="Mesita Places Search Signals" />
            {LIBRARY_SIGNALS.map((row) => {
              const label =
                SIGNALS.find((s) => s.key === row.key)?.label ?? row.key;
              return (
                <tr key={row.key} className="border-border/60 border-b last:border-0">
                  <th className="type-label font-medium pr-3 py-2">{label}</th>
                  {DISCOVERY_MODE_KEYS.map((mode) => {
                    const state = modeSignalState(mode, row.key);
                    return (
                      <td key={mode} className="px-1.5 py-2 text-center">
                        <Flag
                          on={state === "on"}
                          shape="circle"
                          label={`${label} · ${DISCOVERY_MODE_LABELS[mode]} · ${state === "on" ? "on" : "off"}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
