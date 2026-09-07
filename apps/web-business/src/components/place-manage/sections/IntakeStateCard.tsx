"use client";

import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/manage";
import {
  getPlaceEnrichment,
  type AdminPlace,
  type PlaceEnrichmentState,
} from "../actions";
import { isEnriching } from "../place-header-state";
import { stateBoolChip } from "@/lib/state-vocabulary";
import { StateRow } from "./StateCard";
import {
  intakeFunctionRows,
  type EnrichFunctionState,
} from "./state-enrichment";

/**
 * Intake States — the whole pipeline picture in one box (Pato, 2026-08-30):
 * the two SUMMARY facts (Enriching, Enriched) over the eleven functions,
 * 0. Seed … 10. Embedding, each a bool (called / not). Create 1–5 /
 * Enrich 1–10 stay Config sequences, not a third ladder.
 *
 * This box OWNS the enrichment read. It moved here from StateCard with the
 * two rows that need it, so the Admin tab still issues exactly one
 * getPlaceEnrichment call.
 */
export function IntakeStateCard({ place }: { place: AdminPlace }) {
  const seeded: boolean | "unknown" =
    typeof place.seeded === "boolean" ? place.seeded : "unknown";
  const enrichFunctions = (place.enrich_functions ?? null) as
    | Record<string, EnrichFunctionState>
    | null;
  const rows = intakeFunctionRows(enrichFunctions, seeded);

  const [enrichState, setEnrichState] = useState<PlaceEnrichmentState | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    getPlaceEnrichment(place.id).then((r) => {
      if (!alive) return;
      if (r.ok) setEnrichState(r.data.state);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const contentState =
    typeof place.content_state === "string" ? place.content_state : null;
  const enriching = isEnriching(
    enrichState ?? {
      content_state: contentState,
      stage: null,
      stage_state: null,
      error: null,
      last_enriched_at: null,
      updated_at: null,
      serp_summary: null,
    },
  );

  // Enriched is complete-or-not, from the same high-water the catalog uses.
  // A missing number is unknown, not a no.
  const pulse = typeof place.enrich_pulse === "number" ? place.enrich_pulse : null;
  const pulseTotal = typeof place.enrich_pulse_total === "number"
    ? place.enrich_pulse_total
    : null;
  const enriched: boolean | "unknown" =
    pulse === null || pulseTotal === null || pulseTotal === 0
      ? "unknown"
      : pulse >= pulseTotal;

  const enrichedDetail =
    enriched === "unknown"
      ? "Couldn't read the pipeline events."
      : enriched
        ? "The Intake queue finished." +
          (place.enriched_at
            ? ` Last run ${String(place.enriched_at).slice(0, 10)}.`
            : "")
        : "The Intake queue has not finished.";
  const enrichingDetail = enriching
    ? "The Intaker pipeline is mid-flight — research, analysis, or contents is running."
    : "No Intaker run is in flight.";

  return (
    <SectionCard
      icon={<Sprout className="h-4 w-4" />}
      tint="violet"
      title="Intake States"
    >
      <div className="mt-5 flex flex-col">
        <StateRow
          name="Enriching"
          on={enriching}
          chip={stateBoolChip(enriching)}
          tint="violet"
          detail={enrichingDetail}
        />
        <StateRow
          name="Enriched"
          on={enriched === true}
          chip={stateBoolChip(enriched)}
          tint="violet"
          detail={enrichedDetail}
        />
      </div>

      {/* The eleven functions the two facts above summarize. */}
      <div className="border-border/60 mt-4 flex flex-col border-t pt-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="border-border/60 flex items-center justify-between gap-4 border-b py-3.5 first:pt-0 last:border-b-0 last:pb-0"
          >
            <span className="text-foreground/90 type-body font-medium">
              {row.label}
            </span>
            {/* Three answers since MESITA-1608, and the middle one is why the
                truthiness test had to go: "unknown" is a truthy string, so
                `row.on ? …` would have rendered a place we know NOTHING about
                as done. Absent map (the deploy window, or a payload that
                withholds it) reads "?", never "done" and never "—". */}
            <span
              className={
                "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 type-label font-semibold " +
                (row.on === "unknown"
                  ? "bg-muted text-muted-foreground"
                  : row.on
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-amber-500/10 text-amber-700")
              }
              aria-label={`${row.label}: ${
                row.on === "unknown"
                  ? "unknown"
                  : row.failed
                    ? "called, and it failed"
                    : row.on
                      ? "called"
                      : "not called"
              }`}
            >
              {row.on === "unknown" ? "?" : row.on ? "done" : "—"}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
