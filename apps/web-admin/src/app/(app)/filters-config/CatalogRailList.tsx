import { Rows3 } from "lucide-react";
import { KnobState, SectionCard } from "@/components/admin-ui/config";
import {
  CATALOG_FAMILY_FACTS,
  CATALOG_RAIL_CAP,
  CATALOG_SIGNAL_RAILS,
} from "./discovery-surface";

// The Feed's rails, in the order the guest sees them (Pato, 2026-10-17:
// "Modes (include rails here)"). Read-only: the order is code, and the
// ranking profile above is the only Catalog knob.
export function CatalogRailList() {
  const rails = [
    ...CATALOG_SIGNAL_RAILS,
    ...CATALOG_FAMILY_FACTS.map((family) => ({
      key: family.key,
      label: family.label,
      emoji: family.emoji,
      holds: `Mesita Enriched Places in ${family.label}.`,
      order: "Catalog score.",
    })),
  ];
  return (
    <SectionCard
      icon={<Rows3 className="text-primary h-4 w-4" />}
      title="Rails"
      subtitle={`The Feed, top to bottom. Each rail shows up to ${CATALOG_RAIL_CAP} places, and an empty rail is not shown.`}
      state={<KnobState kind="enforced" reason="Fixed in code. Nothing here can be edited." />}
    >
      <ol className="mt-4 flex flex-col">
        {rails.map((rail, index) => (
          <li
            key={rail.key}
            className="border-border/60 grid grid-cols-[2rem_1fr] gap-x-2 border-b py-2.5 last:border-b-0 sm:grid-cols-[2rem_12rem_1fr]"
          >
            <span className="text-muted-foreground text-sm tabular-nums">{index + 1}</span>
            <span className="text-sm font-semibold">
              <span aria-hidden className="mr-1.5">{rail.emoji}</span>
              {rail.label}
            </span>
            <span className="text-muted-foreground col-start-2 text-sm leading-relaxed sm:col-start-3">
              {rail.holds} {rail.order}
            </span>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
