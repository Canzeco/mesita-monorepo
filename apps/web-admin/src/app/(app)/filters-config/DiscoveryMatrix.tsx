import { LayoutGrid } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/config";
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
// Squares = pools and modules. Circles = Places Lineup signals.
// Black / green = on. Grey / red = off. Map Randomness is 0, not missing.

function Square({
  on,
  label,
}: {
  on: boolean;
  label: string;
}) {
  return (
    <span
      title={label}
      className={
        "inline-block size-3 rounded-[2px] " +
        (on ? "bg-foreground" : "border-muted-foreground/40 border bg-transparent")
      }
    />
  );
}

function Flag({
  on,
  zero,
  label,
  shape,
}: {
  on: boolean;
  zero?: boolean;
  label: string;
  shape: "square" | "circle";
}) {
  return (
    <span className="inline-flex items-center justify-center gap-0.5" title={label}>
      <span
        className={
          "inline-block size-3 " +
          (shape === "circle" ? "rounded-full" : "rounded-[2px]") +
          " " +
          (on ? "bg-emerald-500" : "bg-rose-500")
        }
      />
      {zero ? (
        <span className="text-muted-foreground type-meta font-semibold">0</span>
      ) : null}
    </span>
  );
}

export function DiscoveryMatrix() {
  return (
    <SectionCard
      icon={<LayoutGrid className="text-muted-foreground size-4" />}
      title="Discovery matrix"
      subtitle="Locked. Modes across the top. Pools, modules, then Places Lineup signals. Chips on the cards below repeat the green modules."
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
            {DISCOVERY_POOLS.map((pool, index) => (
              <tr
                key={pool.key}
                className={
                  index === DISCOVERY_POOLS.length - 1
                    ? "border-foreground border-b-2"
                    : "border-border/60 border-b"
                }
              >
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
            {DISCOVERY_MODULES.map((module, index) => (
              <tr
                key={module}
                className={
                  index === DISCOVERY_MODULES.length - 1
                    ? "border-foreground border-b-2"
                    : "border-border/60 border-b"
                }
              >
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
                          zero={state === "zero"}
                          shape="circle"
                          label={`Places Lineup ${label} · ${DISCOVERY_MODE_LABELS[mode]} · ${state}`}
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
