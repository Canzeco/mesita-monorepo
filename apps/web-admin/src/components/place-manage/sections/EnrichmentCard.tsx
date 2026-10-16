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
import { OverwriteSwitch } from "../OverwriteSwitch";
import { ENRICH_ACTIONS, type EnrichDepth } from "@/lib/enrich-depth";
import { usePlaceContext } from "../PlaceContext";
import { formatAbsoluteUtc } from "@/lib/format";
import { isEnriching } from "../place-header-state";

// Enrichment — Quick or Full. This is not a scheduler (Pato, 2026-08-25).
// Cadence and mode chips lived here and made a press look like config.
// Quick is Google's record. Full is the whole enrichment.
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
  const [overwrite, setOverwrite] = useState(false);
  const [pendingDepth, setPendingDepth] = useState<EnrichDepth | null>(null);

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

  const runDepth = useCallback((depth: EnrichDepth) => {
    const label = depth === "quick" ? "Quick" : "Full";
    if (alreadyEnriched) {
      const again = window.confirm(
        overwrite
          ? `Run ${label} enrich again and overwrite existing data?`
          : `This place is already enriched. Run ${label} enrich again?`,
      );
      if (!again) return;
    }
    setRunError(null);
    setQueued(false);
    setPendingDepth(depth);
    startRun(async () => {
      try {
        const r = await enrichPlace(place.id, "fill", [], overwrite, depth);
        if (!r.ok) {
          setRunError(r.error);
          return;
        }
        setQueued(true);
        setOverwrite(false);
        setEnrichState((prev) => ({
          content_state: "generating",
          stage: "first",
          stage_state: "queued",
          error: null,
          last_enriched_at: prev?.last_enriched_at ?? null,
          updated_at: new Date().toISOString(),
          serp_summary: prev?.serp_summary ?? null,
        }));
      } finally {
        setPendingDepth(null);
      }
    });
  }, [alreadyEnriched, overwrite, place.id]);

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
              {status}. Last run{" "}
              {enrichState?.last_enriched_at
                ? formatAbsoluteUtc(enrichState.last_enriched_at)
                : "never"}
              . Quick reads Google and stops. Full also finds links, Instagram,
              reviews, and writes the description.
            </p>
          )}

          <div className="mb-4">
            <OverwriteSwitch
              checked={overwrite}
              disabled={runPending || running}
              onChange={setOverwrite}
            />
          </div>

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
              ENRICH_ACTIONS.map((action) => {
                const pending = runPending && pendingDepth === action.depth;
                const quick = action.depth === "quick";
                return (
                  <button
                    key={action.depth}
                    type="button"
                    title={action.title}
                    disabled={runPending || running}
                    onClick={() => {
                      if (guardIntent({ kind: "reenrich", run: () => runDepth(action.depth) })) return;
                      runDepth(action.depth);
                    }}
                    className={
                      quick
                        ? "border-border text-foreground hover:border-foreground/40 inline-flex h-10 items-center rounded-full border bg-card px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                        : "bg-foreground text-paper inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    }
                  >
                    {pending ? "Starting…" : action.label}
                  </button>
                );
              })
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
