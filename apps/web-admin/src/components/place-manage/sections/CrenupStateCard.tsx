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
import { isEnrichedPlace } from "@/lib/place-enriched";
import {
  requestCountChip,
  requestCountFromRow,
  stateBoolChip,
} from "@/lib/state-vocabulary";
import { StateRow } from "./StateCard";
import { FunctionLadder } from "./FunctionLadder";
import {
  crenupMeterLine,
  crenupStepRows,
  type EnrichFunctionState,
} from "./state-enrichment";

/**
 * Enrichment States — the whole pipeline picture in one box (Pato, 2026-08-30;
 * the six states, 2026-10-11): the three facts (Requested, Enriching,
 * Enriched) over the nine functions,
 * 0. Seed … 8. Vectors (CRENUP_STEPS), each a bool (called / not). Create
 * runs 0, 1, 7, 8 — those four also print under General States — and Enrich
 * runs 1–8 of that one ladder, never a second one. A creation function wears
 * Create or Create + Enrich. Enriched is `enriched_at` set (MESITA-2154);
 * the high-water is the meter.
 *
 * This box OWNS the enrichment read. It moved here from StateCard with the
 * two rows that need it, so the Admin tab still issues exactly one
 * getPlaceEnrichment call.
 */
export function CrenupStateCard({ place }: { place: AdminPlace }) {
  const seeded: boolean | "unknown" =
    typeof place.seeded === "boolean" ? place.seeded : "unknown";
  const enrichFunctions = (place.enrich_functions ?? null) as
    | Record<string, EnrichFunctionState>
    | null;
  const rows = crenupStepRows(enrichFunctions, seeded);

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

  // Enriched = an Enrich run completed — `enriched_at` set (MESITA-2154),
  // the server's `enriched`. The same fact the Multiple Places table and the
  // consumer pins read. A Created place (content_state ready, no stamp) is
  // NOT enriched, whatever its high-water.
  const enriched = isEnrichedPlace(place);
  // The Crenup high-water rides the detail line as the completeness meter —
  // "N of 8, stopped at …" — never as the yes/no.
  const meter = crenupMeterLine(place);
  const enrichedAt =
    typeof place.enriched_at === "string" && place.enriched_at.trim() !== ""
      ? place.enriched_at.slice(0, 10)
      : null;
  const enrichedDetail =
    (enriched
      ? "An Enrich run completed" + (enrichedAt ? ` ${enrichedAt}.` : ".")
      : "No Enrich run has completed — a Created profile is not enriched.") +
    (meter ? ` ${meter}` : "");
  const requestCount = requestCountFromRow(place.request_count);
  const requestedDetail =
    requestCount === "unknown"
      ? "Couldn't read the request count."
      : requestCount === 0
        ? "No guest has requested this profile."
        : `${requestCount} guest request${requestCount === 1 ? "" : "s"}.`;
  const enrichingDetail = enriching
    ? "The Enricher pipeline is mid-flight — gather, photos, or write is running."
    : "No Enricher run is in flight.";

  return (
    <SectionCard
      icon={<Sprout className="h-4 w-4" />}
      tint="violet"
      title="Enrichment States"
    >
      <div className="mt-5 flex flex-col">
        <StateRow
          name="Requested"
          on={requestCount !== "unknown" && requestCount > 0}
          chip={requestCountChip(place.request_count)}
          detail={requestedDetail}
        />
        <StateRow
          name="Enriching"
          on={enriching}
          chip={stateBoolChip(enriching)}
          detail={enrichingDetail}
        />
        <StateRow
          name="Enriched"
          on={enriched === true}
          chip={stateBoolChip(enriched)}
          detail={enrichedDetail}
        />
      </div>

      <FunctionLadder rows={rows} />
    </SectionCard>
  );
}
