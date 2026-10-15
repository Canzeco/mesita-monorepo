"use client";

import { Check, Loader2, Sparkles } from "lucide-react";

import { inertButtonProps } from "../../actions";
import { cn } from "../../lib/format";
import { ERROR_BOX_CLASS } from "../../lib/ui";

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

  return (
    <section className="border-border bg-card shadow-elev overflow-hidden rounded-2xl border">
      <div className="from-primary/12 via-primary/6 to-card bg-gradient-to-b px-5 pb-4 pt-6 text-center">
        <span className="bg-primary/15 text-primary shadow-glow-sm mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
          <Sparkles className="h-7 w-7" strokeWidth={2} />
        </span>
        <h3 className="font-display mt-4 text-xl font-semibold tracking-tight">
          Vote to enrich this place
        </h3>
        <p className="text-muted-foreground mx-auto mt-2 max-w-[32ch] text-sm leading-relaxed">
          The profile is on Mesita. Guest votes unlock the full Enrich pass.
        </p>
      </div>

      <div className="px-5 pb-5 pt-1">
        <div
          className="border-border bg-background/80 rounded-2xl border px-4 py-4"
          aria-label={requestProgressLabel(count, threshold)}
        >
          <div className="flex items-end justify-between gap-3">
            <div className="text-left">
              <p className="text-muted-foreground type-label font-semibold uppercase tracking-wide">
                Community votes
              </p>
              <p className="font-display mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                {progress.filled}
                <span className="text-muted-foreground text-lg font-medium">
                  {" "}
                  / {progress.threshold}
                </span>
              </p>
            </div>
            <p className="text-muted-foreground max-w-[14ch] text-right text-xs leading-snug">
              {remainingCopy(progress.remaining, progress.complete)}
            </p>
          </div>

          <div
            className="mt-4 flex gap-1.5"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.threshold}
            aria-valuenow={progress.filled}
          >
            {Array.from({ length: progress.threshold }, (_, i) => {
              const filled = i < progress.filled;
              return (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 min-w-0 flex-1 rounded-full transition-colors",
                    filled ? "bg-primary shadow-glow-sm" : "bg-muted",
                  )}
                />
              );
            })}
          </div>
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
            "bg-pink-gradient inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold whitespace-nowrap text-white shadow-glow transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
            requested && "bg-muted text-foreground hover:bg-muted",
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
          <p className="text-muted-foreground mt-3 text-center text-xs leading-relaxed">
            Thanks — share this place so others can vote too.
          </p>
        ) : null}
      </div>
    </section>
  );
}
