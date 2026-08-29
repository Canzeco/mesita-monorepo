import { LayoutGrid } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/config";
import { Flag, Square } from "./DiscoveryFlags";
import {
  DISCOVERY_MODE_KEYS,
  DISCOVERY_MODE_LABELS,
  DISCOVERY_MODULES,
  DISCOVERY_POOLS,
  LIBRARY_SIGNALS,
  SIGNALS,
  modeCallsModule,
  modeRequiresPool,
  modeSignalState,
} from "./catalog";

// Locked mode × pool × module × signal matrix (Pato, 2026-08-28).
// Three bands: Places Types · Search Modules · Places Lineup Signals.
// Two rules separate the bands. Map Randomness is off, not a printed 0.

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
      subtitle="Locked. Modes across the top. Places Types, Search Modules, then Places Lineup Signals. Chips on the cards below repeat the green modules."
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
            <BandTitle title="Search Modules" />
            {DISCOVERY_MODULES.map((module) => (
              <tr key={module} className="border-border/60 border-b">
                <th className="type-label font-medium pr-3 py-2">{module}</th>
                {DISCOVERY_MODE_KEYS.map((mode) => {
                  const on = modeCallsModule(mode, module);
                  return (
                    <td key={mode} className="px-1.5 py-2 text-center">
                      <Flag
                        on={on}
                        shape="square"
                        label={`${module} · ${DISCOVERY_MODE_LABELS[mode]} · ${on ? "on" : "off"}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            <BandRule />
            <BandTitle title="Places Lineup Signals" />
            {LIBRARY_SIGNALS.map((row) => {
              const label =
                SIGNALS.find((s) => s.key === row.key)?.label ?? row.key;
              return (
                <tr key={row.key} className="border-border/60 border-b last:border-0">
                  <th className="type-label font-medium pr-3 py-2">
                    Places Lineup {label}
                  </th>
                  {DISCOVERY_MODE_KEYS.map((mode) => {
                    const state = modeSignalState(mode, row.key);
                    return (
                      <td key={mode} className="px-1.5 py-2 text-center">
                        <Flag
                          on={state === "on"}
                          shape="circle"
                          label={`Places Lineup ${label} · ${DISCOVERY_MODE_LABELS[mode]} · ${state === "on" ? "on" : "off"}`}
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
