"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  enrichPlace,
  getPlaceEnrichment,
  type AdminPlace,
  type PlaceEnrichmentState,
} from "../actions";
import { SectionCard, Spinner } from "@/components/admin-ui/manage";
import { usePlaceContext } from "../PlaceContext";
import { formatAbsoluteUtc } from "@/lib/format";
import { isEnriching } from "../place-header-state";

// Enrichment — one button. This is not a scheduler (Pato, 2026-08-25).
// Cadence and mode chips lived here and made a press look like config.
// The only action is Run the full Intaker process now.
//
// The live run STATE stays in the chrome. This box only queues.

export function EnrichmentCard({ place }: { place: AdminPlace }) {
  const [enrichState, setEnrichState] = useState<PlaceEnrichmentState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { guardIntent } = usePlaceContext();
  const [runPending, startRun] = useTransition();
  const [runError, setRunError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

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

  const runFull = useCallback(() => {
    setRunError(null);
    setQueued(false);
    startRun(async () => {
      const r = await enrichPlace(place.id, "full");
      if (!r.ok) {
        setRunError(r.error);
        return;
      }
      setQueued(true);
      setEnrichState((prev) => ({
        content_state: "generating",
        stage: "research",
        stage_state: "queued",
        error: null,
        last_enriched_at: prev?.last_enriched_at ?? null,
        updated_at: new Date().toISOString(),
        serp_summary: prev?.serp_summary ?? null,
      }));
    });
  }, [place.id]);

  return (
    <SectionCard
      icon={<Sparkles className="h-4 w-4" />}
      tint="indigo"
      title="Enrichment"
    >
      {!loaded ? (
        <div className="mt-5">
          <Spinner label="Loading…" />
        </div>
      ) : (
        <div className="mt-5">
          {loadError ? (
            <p className="text-destructive mb-3 text-xs leading-relaxed">
              Couldn&apos;t load the last run: {loadError}
            </p>
          ) : (
            <p className="text-muted-foreground mb-4 text-xs leading-relaxed">
              Last run{" "}
              {enrichState?.last_enriched_at
                ? formatAbsoluteUtc(enrichState.last_enriched_at)
                : "never"}
              . This queues the full Intaker process — gather, then write.
            </p>
          )}

          <button
            type="button"
            disabled={runPending || running}
            onClick={() => {
              if (guardIntent({ kind: "reenrich", run: runFull })) return;
              runFull();
            }}
            className="bg-foreground text-background inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runPending ? "Queuing…" : running ? "Enriching…" : "Enrich"}
          </button>

          <p className="mt-2 min-h-4 type-label" aria-live="polite">
            {runError ? (
              <span className="text-destructive">{runError}</span>
            ) : queued ? (
              <span className="text-muted-foreground">
                Queued — the Intaker picks it up within seconds.
              </span>
            ) : running ? (
              <span className="text-muted-foreground">
                A run is in flight. State is in the header.
              </span>
            ) : null}
          </p>
        </div>
      )}
    </SectionCard>
  );
}
