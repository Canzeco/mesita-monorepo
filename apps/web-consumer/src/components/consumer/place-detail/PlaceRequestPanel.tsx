"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiRequestPlace } from "@/lib/api/places";
import type { PlaceDetail } from "@/lib/mock/place";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { errMsg } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";

/** Enrich tab: not Enriched yet. The ugly profile stays visible. */
export function showEnrichTab(
  place: Pick<PlaceDetail, "is_enriched">,
): boolean {
  return place.is_enriched !== true;
}

export function requestProgressLabel(count: number, threshold: number): string {
  const n = Math.max(0, Math.trunc(count));
  const t = Math.max(1, Math.trunc(threshold));
  return `${n} of ${t} votes`;
}

export function PlaceRequestPanelView({
  count,
  threshold,
  requested,
  enriching,
  pending,
  error,
  onRequest,
}: {
  count: number;
  threshold: number;
  requested: boolean;
  enriching: boolean;
  pending: boolean;
  error: string | null;
  onRequest?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-2 py-8 text-center">
      <span className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-2xl">
        <Sparkles className="h-7 w-7" strokeWidth={2} />
      </span>
      <h3 className="font-display mt-4 text-lg font-semibold tracking-tight">
        Vote to enrich this place
      </h3>
      <p className="text-muted-foreground mt-1.5 max-w-[34ch] text-sm leading-relaxed">
        The profile is on Mesita. Enrich fills the rest once enough guests vote.
      </p>
      <p className="text-foreground mt-4 text-sm font-semibold">
        {requestProgressLabel(count, threshold)}
      </p>
      {enriching ? (
        <p className="text-muted-foreground mt-2 inline-flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Enriching
        </p>
      ) : null}
      {error ? (
        <p className={ERROR_BOX_CLASS + " mt-3 max-w-sm py-1.5"}>{error}</p>
      ) : null}
      <Button
        type="button"
        onClick={onRequest}
        disabled={requested || pending || enriching}
        className="shadow-glow mt-5 text-sm font-semibold active:scale-[0.98]"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : null}
        {requested ? "Voted" : "Vote to enrich"}
      </Button>
    </div>
  );
}

export function PlaceRequestPanel({
  place,
  onState,
}: {
  place: PlaceDetail;
  onState?: (next: Partial<PlaceDetail>) => void;
}) {
  const supabase = useBrowserSupabase();
  const [count, setCount] = useState(place.request_count);
  const [threshold, setThreshold] = useState(place.request_threshold);
  const [requested, setRequested] = useState(place.requested);
  const [enriching, setEnriching] = useState(place.is_enriching);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    if (requested || pending) return;
    setPending(true);
    setError(null);
    try {
      const r = await apiRequestPlace(supabase, place.id);
      setCount(r.request_count);
      setThreshold(r.request_threshold);
      setRequested(r.requested);
      if (r.enrichment_triggered) setEnriching(true);
      onState?.({
        request_count: r.request_count,
        request_threshold: r.request_threshold,
        requested: r.requested,
        is_profile_ready: r.is_profile_ready,
        is_enriched: r.is_enriched,
        request_lifecycle: r.request_lifecycle,
        is_enriching: r.enrichment_triggered || place.is_enriching,
      });
    } catch (err) {
      setError(errMsg(err, "Could not send the vote."));
    } finally {
      setPending(false);
    }
  };

  return (
    <PlaceRequestPanelView
      count={count}
      threshold={threshold}
      requested={requested}
      enriching={enriching}
      pending={pending}
      error={error}
      onRequest={() => void request()}
    />
  );
}
