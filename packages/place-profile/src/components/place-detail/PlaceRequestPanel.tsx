"use client";

import { Check, Loader2, Sparkles } from "lucide-react";

import { inertButtonProps } from "../../actions";
import { cn } from "../../lib/format";
import {
  ERROR_BOX_CLASS,
  PLACE_BUTTON_CLASS,
  PLACE_SCREEN_TITLE_CLASS,
} from "../../lib/ui";

export function requestProgressLabel(count: number, threshold: number): string {
  const n = Math.max(0, Math.trunc(count));
  const t = Math.max(1, Math.trunc(threshold));
  return `${n} of ${t} votes`;
}

export function requestProgressMeta(count: number, threshold: number) {
  const n = Math.max(0, Math.trunc(count));
  const t = Math.max(1, Math.trunc(threshold));
  const filled = Math.min(t, n);
  return {
    count: n,
    threshold: t,
    filled,
    remaining: Math.max(0, t - n),
    complete: n >= t,
  };
}

function remainingCopy(remaining: number, complete: boolean): string {
  if (complete) return "Enough votes — Enrich is starting";
  if (remaining === 1) return "1 more vote starts Enrich";
  return `${remaining} more votes start Enrich`;
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
  const progress = requestProgressMeta(count, threshold);
  const voteDisabled = requested || pending || enriching || progress.complete;

  // One flat white band under the summary, like the flat reviews list
  // (MESITA-2309): no card, no gradient, no box inside a box (MESITA-2315).
  return (
    <section className="bg-card border-border border-b px-6 pt-8 pb-6 text-center">
      <span className="bg-muted text-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
        <Sparkles className="h-6 w-6" strokeWidth={2} />
      </span>
      <h3 className={cn(PLACE_SCREEN_TITLE_CLASS, "mt-4")}>
        Vote to enrich this place
      </h3>
      <p className="text-muted-foreground mx-auto mt-1.5 max-w-[32ch] text-sm leading-relaxed">
        The profile is on Mesita. Guest votes unlock the full Enrich pass.
      </p>

      <div
        className="mx-auto mt-6 max-w-sm"
        aria-label={requestProgressLabel(count, threshold)}
      >
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-foreground font-semibold tabular-nums">
            {`${progress.filled} of ${progress.threshold} ${progress.threshold === 1 ? "vote" : "votes"}`}
          </span>
          <span className="text-muted-foreground text-xs">
            {remainingCopy(progress.remaining, progress.complete)}
          </span>
        </div>
        <div
          className="mt-2 flex gap-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.threshold}
          aria-valuenow={progress.filled}
        >
          {Array.from({ length: progress.threshold }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 min-w-0 flex-1 rounded-full transition-colors",
                i < progress.filled ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {enriching ? (
          <p className="text-muted-foreground mt-4 inline-flex w-full items-center justify-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enriching this profile
          </p>
        ) : null}

        {error ? (
          <p className={ERROR_BOX_CLASS + " mt-3 py-1.5"}>{error}</p>
        ) : null}

        <button
          type="button"
          {...(onRequest
            ? { onClick: onRequest, disabled: voteDisabled }
            : inertButtonProps(false))}
          className={cn(
            // The place scale's button (MESITA-2636): 44px, rounded-lg,
            // ink; not the pink-gradient pill.
            PLACE_BUTTON_CLASS,
            "mt-5 w-full text-sm disabled:pointer-events-none disabled:opacity-60",
            requested
              ? "bg-muted text-foreground"
              : "bg-foreground text-paper hover:opacity-90",
          )}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : requested ? (
            <>
              <Check className="h-4 w-4" strokeWidth={2.5} />
              You voted
            </>
          ) : progress.complete ? (
            "Votes complete"
          ) : (
            "Vote to enrich"
          )}
        </button>

        {requested && !enriching && !progress.complete ? (
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Thanks — share this place so others can vote too.
          </p>
        ) : null}
      </div>
    </section>
  );
}
