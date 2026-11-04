"use client";

import { useEffect, useState } from "react";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr";
import {
  getPlaceEnrichment,
  type AdminPlace,
  type PlaceEnrichmentState,
} from "../actions";
import { SectionCard, Spinner } from "@/components/ui/manage";
import { formatAbsoluteUtc } from "@/lib/format";
import { isEnriching } from "../place-header-state";

// Enrichment — the last run's state: one Enrich, the whole pipeline,
// replacing what it finds (MESITA-2799: no Overwrite switch, no Weak/Strong).
// This is not a scheduler (Pato, 2026-08-25). The buttons live in Special
// actions since MESITA-3159 (Enrich, Update Google, Update Reviews, Enable,
// Disable); this box only reads.

export function EnrichmentCard({ place }: { place: AdminPlace }) {
  const [enrichState, setEnrichState] = useState<PlaceEnrichmentState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getPlaceEnrichment(place.id).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setLoadError(r.error);
        setLoaded(true);
        return;
      }
      setEnrichState(r.data.state);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const running = isEnriching(enrichState);
  // Enriched is a finished Enrich run (enriched_at), never `ready` alone: Create
  // leaves every new place ready (MESITA-2811).
  const alreadyEnriched = Boolean(enrichState?.last_enriched_at);
  const status = running
    ? "Enriching"
    : enrichState?.content_state === "failed"
    ? "Failed"
    : alreadyEnriched
    ? "Enriched"
    : "Never enriched";

  return (
    <SectionCard
      icon={<SparkleIcon size={20} />}
      title="Enrichment"
    >
      {!loaded ? (
        <div className="mt-5">
          <Spinner label="Loading…" />
        </div>
      ) : (
        <div className="mt-5">
          {loadError ? (
            <p className="text-destructive text-xs leading-relaxed">
              Couldn&apos;t load the last run: {loadError}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs leading-relaxed">
              State: {status}. Last run{" "}
              {enrichState?.last_enriched_at
                ? formatAbsoluteUtc(enrichState.last_enriched_at)
                : "never"}
              . Enrich runs links, reviews, photos, and presentation synthesis, and replaces what it finds. Run it from Special actions.
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
