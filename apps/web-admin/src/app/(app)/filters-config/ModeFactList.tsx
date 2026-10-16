import Link from "next/link";
import { Search } from "lucide-react";
import { KnobState, SectionCard } from "@/components/admin-ui/config";
import {
  DISCOVERY_MODE_SOURCES,
  DISCOVERY_MODES,
  sourceByKey,
  type DiscoverySurfaceModeKey,
} from "./discovery-surface";
import { DISCOVERY_CATALOG_HREF } from "./nav";

function sourcesFor(mode: DiscoverySurfaceModeKey): string {
  const keys = DISCOVERY_MODE_SOURCES[mode];
  if (keys.length === 0) return "None";
  return keys.map((key) => sourceByKey(key).label).join(", ");
}

export function ModeFactList() {
  return (
    <div className="flex flex-col gap-4">
      {DISCOVERY_MODES.map((mode) => (
        <SectionCard
          key={mode.key}
          icon={<Search className="text-primary h-4 w-4" />}
          title={mode.label}
          subtitle={mode.intent}
          state={
            <KnobState
              kind={mode.availability === "live" ? "enforced" : "not-wired"}
              reason={mode.availabilityLabel}
            />
          }
        >
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Fact label="Input" value={mode.input} />
            <Fact label="Sources" value={sourcesFor(mode.key)} />
            <Fact label="How results are chosen" value={mode.selection} />
            <Fact label="What comes back" value={mode.output} />
          </dl>
          {mode.signals.length === 1 ? (
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              This mode uses one signal, so that signal decides the Mesita order.
              There is no weight to edit.
            </p>
          ) : null}
          {mode.signals.length > 1 && !mode.weightsEditable ? (
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              Several signals combine here. Their weights are on{" "}
              <Link href={DISCOVERY_CATALOG_HREF} className="text-foreground font-medium underline">
                Catalog
              </Link>
              .
            </p>
          ) : null}
          {mode.weightsEditable ? (
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              Several signals combine. Their exponents are in Ranking on this
              page. A zero turns that signal off for this mode.
            </p>
          ) : null}
          {mode.availability === "unavailable" ? (
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              Unavailable. No screen calls it, so there is nothing to configure.
            </p>
          ) : null}
        </SectionCard>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground type-meta font-semibold">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed">{value}</dd>
    </div>
  );
}
