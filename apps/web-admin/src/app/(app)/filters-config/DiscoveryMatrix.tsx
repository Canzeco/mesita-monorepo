import { Blocks } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/config";
import { Mark } from "./DiscoveryMarks";
import {
  DISCOVERY_MODES,
  DISCOVERY_ROUTING_EDITABLE,
  DISCOVERY_SOURCES,
  modeCallsSource,
} from "./discovery-surface";

const COLS = 1 + DISCOVERY_MODES.length;

export function DiscoveryMatrix() {
  return (
    <SectionCard
      icon={<Blocks className="text-muted-foreground size-4" />}
      title="Modes and sources"
      subtitle="Fixed. A filled mark means that mode calls that source. There is no fallback order, and nothing in this grid can be edited."
    >
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <thead>
            <tr className="border-border border-b">
              <th className="text-muted-foreground type-meta py-2 pr-3 font-semibold">
                Source
              </th>
              {DISCOVERY_MODES.map((mode) => (
                <th
                  key={mode.key}
                  className="text-muted-foreground type-meta px-1.5 py-2 text-center font-semibold"
                >
                  {mode.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DISCOVERY_SOURCES.map((source) => (
              <tr key={source.key} className="border-border/60 border-b">
                <th className="py-2 pr-3">
                  <span className="type-label block font-medium">{source.label}</span>
                  <span className="text-muted-foreground type-meta block">
                    {source.availabilityLabel}
                    {DISCOVERY_ROUTING_EDITABLE ? "" : " · Fixed"}
                  </span>
                </th>
                {DISCOVERY_MODES.map((mode) => {
                  const on = modeCallsSource(mode.key, source.key);
                  const state = on ? "calls" : "does not call";
                  return (
                    <td key={mode.key} className="px-1.5 py-2 text-center">
                      <Mark
                        on={on}
                        label={`${source.label} · ${mode.label} · ${state}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr aria-hidden>
              <td colSpan={COLS} className="px-0 py-3">
                <div className="border-border border-t-2" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        Word calls Autocomplete, Text Search, and Name Search together. Map
        calls Nearby Search on Google and on Mesita. Catalog calls the Mesita
        catalog. Chat and Favorites call no source. Social Catalog is
        unavailable, so every cell in that row stays off.
      </p>
    </SectionCard>
  );
}
