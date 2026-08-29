"use client";

import { Sprout } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/manage";
import type { AdminPlace } from "../actions";
import {
  intakeFunctionRows,
  type EnrichFunctionState,
} from "./status-enrichment";

/**
 * Intake box — eleven functions in one order, each a bool (called / not).
 * Numbered 0. Seed … 10. Embedding. Create 1–5 / Enrich 1–10 stay Config.
 */
export function IntakeStatusCard({ place }: { place: AdminPlace }) {
  const seeded: boolean | "unknown" =
    typeof place.seeded === "boolean" ? place.seeded : "unknown";
  const enrichFunctions = (place.enrich_functions ?? null) as
    | Record<string, EnrichFunctionState>
    | null;
  const rows = intakeFunctionRows(enrichFunctions, seeded);

  return (
    <SectionCard
      icon={<Sprout className="h-4 w-4" />}
      tint="violet"
      title="Intake"
    >
      <div className="mt-5 flex flex-col">
        {rows.map((row) => (
          <div
            key={row.key}
            className="border-border/60 flex items-center justify-between gap-4 border-b py-3.5 first:pt-0 last:border-b-0 last:pb-0"
          >
            <span className="text-foreground/90 type-body font-medium">
              {row.label}
            </span>
            <span
              className={
                "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 type-label font-semibold " +
                (row.on
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-amber-500/10 text-amber-700")
              }
              aria-label={`${row.label}: ${row.on ? "called" : "not called"}`}
            >
              {row.on ? "done" : "—"}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
