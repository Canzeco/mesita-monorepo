"use client";

import { ListOrdered, Plus } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/manage";
import type { AdminPlace } from "../actions";
import {
  createFunctionRows,
  enrichFunctionRows,
  type EnrichFunctionRow,
  type EnrichFunctionState,
} from "./status-enrichment";

// Intake Create · Intake Enrich — the other two Status boxes (MESITA-1314).
// General facts stay on Status. These list the numbered subfunctions from
// Intake chips, never a third ladder. Create Serp is not a create function.

function functionMap(place: AdminPlace): Record<string, EnrichFunctionState> | null {
  return (place.enrich_functions ?? null) as Record<string, EnrichFunctionState> | null;
}

export function CreateStatusCard({ place }: { place: AdminPlace }) {
  const seeded = place.seeded === true;
  const rows = createFunctionRows(functionMap(place), seeded);
  return (
    <SectionCard
      icon={<Plus className="h-4 w-4" />}
      tint="sky"
      title="Create"
      subtitle="One function. It awaits four subfunctions."
    >
      <FunctionStatusList rows={rows} tint="sky" />
    </SectionCard>
  );
}

export function EnrichStatusCard({ place }: { place: AdminPlace }) {
  const rows = enrichFunctionRows(functionMap(place));
  return (
    <SectionCard
      icon={<ListOrdered className="h-4 w-4" />}
      tint="violet"
      title="Enrich"
      subtitle="Ten functions."
    >
      <FunctionStatusList rows={rows} tint="violet" />
    </SectionCard>
  );
}

function FunctionStatusList({
  rows,
  tint,
}: {
  rows: EnrichFunctionRow[];
  tint: "sky" | "violet";
}) {
  const doneClass = tint === "sky" ? "text-sky-700" : "text-violet-700";
  return (
    <ul className="mt-5 flex flex-col">
      {rows.map((row) => (
        <li
          key={row.key}
          className="border-border/60 flex items-baseline justify-between gap-3 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0"
        >
          <span className="text-foreground/80 type-label">{row.label}</span>
          <span
            className={
              "type-label shrink-0 font-semibold tabular-nums " +
              (row.status === "completed"
                ? doneClass
                : row.status === "failed"
                  ? "text-destructive"
                  : "text-muted-foreground")
            }
          >
            {row.status === "completed"
              ? "done"
              : row.status === "failed"
                ? "failed"
                : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}
