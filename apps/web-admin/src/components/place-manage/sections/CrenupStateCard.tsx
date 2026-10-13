"use client";

import { Sprout } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/manage";
import type { AdminPlace } from "../actions";
import { FunctionLadder } from "./FunctionLadder";
import {
  enrichmentStepRows,
  type EnrichFunctionState,
} from "./state-enrichment";

/**
 * Enrichment Steps — the Enrich pass of the ladder (Pato, 2026-10-13,
 * MESITA-2176): 1. Details Enriched … 8. Vectors Enriched. Seed is
 * Create-only and is not a step here. Details, Description and Vectors
 * also run on Create; this box reports the Enrich pass. Function 8's key
 * stays `embedding`.
 *
 * Profile States owns the enrichment read (Enriching). These rows come off
 * the place payload's function map.
 */
export function CrenupStateCard({ place }: { place: AdminPlace }) {
  const seeded: boolean | "unknown" =
    typeof place.seeded === "boolean" ? place.seeded : "unknown";
  const enrichFunctions = (place.enrich_functions ?? null) as
    | Record<string, EnrichFunctionState>
    | null;
  const rows = enrichmentStepRows(enrichFunctions, seeded);

  return (
    <SectionCard
      icon={<Sprout className="h-4 w-4" />}
      tint="violet"
      title="Enrichment Steps"
    >
      <FunctionLadder rows={rows} />
    </SectionCard>
  );
}
