"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { apiRequestPlace, type Place } from "@/lib/api/places";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

/**
 * The Enrich vote on a Created place's catalog card (MESITA-2293). It casts
 * the same vote as the place page's Enrich tab, through the same
 * `consumer-web-request-place`; enough votes start Enrich. It sits on the
 * photo, so a Created card is as tall as an enriched one. The catalog does
 * not know whether this guest already voted: a repeat vote is harmless, and
 * the server's answer says "Voted" either way.
 */
export function CatalogEnrichChip({
  place,
  className,
}: {
  place: Pick<Place, "id" | "name">;
  className?: string;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const [voted, setVoted] = useState<{
    count: number;
    threshold: number;
  } | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const chip =
    "border-border bg-background/90 text-foreground shadow-elev inline-flex h-7 items-center gap-1 rounded-full border px-2.5 type-label font-semibold backdrop-blur-xl";

  if (enriching) {
    return (
      <span className={cn(chip, className)}>
        <Sparkles className="h-3 w-3" aria-hidden />
        Enriching
      </span>
    );
  }
  if (voted) {
    return (
      <span
        className={cn(chip, className)}
        aria-label={`Voted to enrich ${place.name}: ${voted.count} of ${voted.threshold} votes`}
      >
        <Check className="h-3 w-3" aria-hidden />
        <span className="tabular-nums">
          Voted · {voted.count}/{voted.threshold}
        </span>
      </span>
    );
  }

  const vote = async () => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const r = await apiRequestPlace(getSupabase(), place.id);
      if (r.enrichment_triggered || r.is_enriched) setEnriching(true);
      else setVoted({ count: r.request_count, threshold: r.request_threshold });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void vote()}
      disabled={pending}
      aria-label={
        failed
          ? `Vote to enrich ${place.name} failed, try again`
          : `Vote to enrich ${place.name}`
      }
      className={cn(
        chip,
        "transition active:scale-[0.97] disabled:opacity-70",
        className,
      )}
    >
      <Sparkles className="h-3 w-3" aria-hidden />
      {pending ? "Voting" : failed ? "Try again" : "Enrich"}
    </button>
  );
}
