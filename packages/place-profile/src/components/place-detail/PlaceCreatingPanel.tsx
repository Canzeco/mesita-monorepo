"use client";

import { AlertCircle } from "lucide-react";

import { ERROR_BOX_CLASS } from "../../lib/ui";
import { Spinner } from "../Spinner";

// The vote band's slot while a Google-only profile is being created
// (MESITA-2307): the guest sees Google's profile at once, and this band
// says Mesita is saving it. Nothing to vote on yet — the place is not on
// Mesita until the create lands; then the real profile takes over. One
// flat white band under the summary, like the vote band (MESITA-2315).
export function PlaceCreatingPanel({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry?: () => void;
}) {
  return (
    <section
      className="bg-card border-border border-b px-6 pt-8 pb-6 text-center"
      data-creating={error ? "failed" : "creating"}
    >
      <span className="bg-primary/10 text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-full">
        {error ? (
          <AlertCircle className="h-6 w-6" strokeWidth={2} />
        ) : (
          <Spinner size="md" label="Creating profile" />
        )}
      </span>
      <h3 className="font-display mt-4 text-xl font-semibold tracking-tight">
        {error ? "Couldn't create this profile" : "Creating profile"}
      </h3>
      {error ? (
        <div className="mx-auto mt-1.5 max-w-sm">
          <p className={ERROR_BOX_CLASS + " mt-3 py-1.5"}>{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="bg-foreground text-paper mt-4 min-h-11 rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Try again
            </button>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-[32ch] text-sm leading-relaxed">
          A few seconds. Google&apos;s profile is on screen while Mesita
          saves it; the Enrich vote opens right after.
        </p>
      )}
    </section>
  );
}
