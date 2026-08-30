"use client";

import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/manage";
import {
  getPlaceEnrichment,
  type AdminPlace,
  type PlaceEnrichmentStatus,
} from "../actions";
import { isEnriching } from "../place-header-status";
import { statusBoolChip } from "@/lib/status-vocabulary";
import { StatusRow } from "./StatusCard";
import {
  intakeFunctionRows,
  type EnrichFunctionState,
} from "./status-enrichment";

/**
 * Intake Statuses — the whole pipeline picture in one box (Pato, 2026-08-30):
 * the two SUMMARY facts (Enriched, Enriching) over the eleven functions,
 * 0. Seed … 10. Embedding, each a bool (called / not). Create 1–5 /
 * Enrich 1–10 stay Config sequences, not a third ladder.
 *
 * This box OWNS the enrichment read. It moved here from StatusCard with the
 * two rows that need it, so the Admin tab still issues exactly one
 * getPlaceEnrichment call.
 */
export function IntakeStatusCard({ place }: { place: AdminPlace }) {
  const seeded: boolean | "unknown" =
    typeof place.seeded === "boolean" ? place.seeded : "unknown";
  const enrichFunctions = (place.enrich_functions ?? null) as
    | Record<string, EnrichFunctionState>
    | null;
  const rows = intakeFunctionRows(enrichFunctions, seeded);

  const [enrichStatus, setEnrichStatus] = useState<PlaceEnrichmentStatus | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    getPlaceEnrichment(place.id).then((r) => {
      if (!alive) return;
      if (r.ok) setEnrichStatus(r.data.status);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const contentStatus =
    typeof place.content_status === "string" ? place.content_status : null;
  const enriching = isEnriching(
    enrichStatus ?? {
      content_status: contentStatus,
      stage: null,
      stage_status: null,
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
      title="Intake Statuses"
    >
      <div className="mt-5 flex flex-col">
        <StatusRow
          name="Enriched"
          on={enriched === true}
          chip={statusBoolChip(enriched)}
          tint="violet"
          detail={enrichedDetail}
        />
        <StatusRow
          name="Enriching"
          on={enriching}
          chip={statusBoolChip(enriching)}
          tint="violet"
          detail={enrichingDetail}
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
