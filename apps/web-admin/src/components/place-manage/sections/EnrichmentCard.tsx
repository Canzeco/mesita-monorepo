"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { enrichPlace } from "@/app/(app)/manage-multiple/actions";
import {
  getPlaceEnrichment,
  type AdminPlace,
  type PlaceEnrichmentState,
} from "../actions";
import { SectionCard, Spinner } from "@/components/admin-ui/manage";
import { usePlaceContext } from "../PlaceContext";
import { formatAbsoluteUtc } from "@/lib/format";
import { isEnriching } from "../place-header-state";

// Enrichment — one Enrich, the whole pipeline, replacing what it finds
// (MESITA-2799: no Overwrite switch, no Weak/Strong). This is not a scheduler
// (Pato, 2026-08-25). The live run STATE stays in the chrome. This box only
// queues.

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
  const alreadyEnriched = Boolean(enrichState?.last_enriched_at) || enrichState?.content_state === "ready";
  const status = running
    ? "Enriching"
    : enrichState?.content_state === "failed"
    ? "Failed"
    : alreadyEnriched
    ? "Enriched"
    : "Never enriched";

  const run = useCallback(() => {
    if (alreadyEnriched && !window.confirm("This place is already enriched. Run Enrich again?")) return;
    setRunError(null);
    setQueued(false);
    startRun(async () => {
      const r = await enrichPlace(place.id);
      if (!r.ok) {
        setRunError(r.error);
        return;
      }
      setQueued(true);
      setEnrichState((prev) => ({
        content_state: "generating",
        stage: "first",
        stage_state: "queued",
        error: null,
        last_enriched_at: prev?.last_enriched_at ?? null,
        updated_at: new Date().toISOString(),
        serp_summary: prev?.serp_summary ?? null,
      }));
    });
  }, [alreadyEnriched, place.id]);

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
              State: {status}. Last run{" "}
              {enrichState?.last_enriched_at
                ? formatAbsoluteUtc(enrichState.last_enriched_at)
                : "never"}
              . Result: {enrichState?.error ? "Error" : status}. Enrich runs links,
              reviews, photos, and presentation synthesis, and replaces what it finds.
            </p>
          )}

          <p className="mb-2 text-sm font-semibold">Run Enrichment</p>
          <div className="flex flex-wrap gap-2">
            {running && !runPending ? (
              <button
                type="button"
                disabled
                aria-busy="true"
                className="bg-foreground text-paper inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enriching…
              </button>
            ) : (
              <button
                type="button"
                disabled={runPending || running}
                onClick={() => {
                  if (guardIntent({ kind: "reenrich", run })) return;
                  run();
                }}
                className="bg-foreground text-paper inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {runPending ? "Starting…" : "Enrich"}
              </button>
            )}
          </div>

          <p className="mt-2 min-h-4 type-label" aria-live="polite">
            {runError ? (
              <span className="text-destructive">{runError}</span>
            ) : enrichState?.error ? (
              <span className="text-destructive">{enrichState.error}</span>
            ) : queued ? (
              <span className="text-muted-foreground">Started.</span>
            ) : running ? (
              <span className="text-muted-foreground">Enrichment is running.</span>
            ) : null}
          </p>
        </div>
      )}
    </SectionCard>
  );
}
