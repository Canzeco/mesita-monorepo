"use client";

import { AlertCircle } from "lucide-react";

import {
  ERROR_BOX_CLASS,
  PLACE_BUTTON_CLASS,
  PLACE_SCREEN_TITLE_CLASS,
} from "../../lib/ui";

// A refused create (MESITA-2307): Google's profile stays on screen and this
// band, at the top of Overview, says why, with Try again when the screen can
// run the create again. While the create runs there is no band: a Creating
// fact leads the facts row, drawn like Enriching (MESITA-2679, Pato: "the
// creating there looks like shit"). One flat white band under the summary
// (MESITA-2315).
export function PlaceCreateFailedPanel({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <section
      className="bg-card border-border border-b px-6 pt-8 pb-6 text-center"
      data-creating="failed"
    >
      <span className="bg-muted text-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
        <AlertCircle className="h-6 w-6" strokeWidth={2} />
      </span>
      <h3 className={PLACE_SCREEN_TITLE_CLASS + " mt-4"}>
        Couldn&apos;t create this profile
      </h3>
      <div className="mx-auto mt-1.5 max-w-sm">
        <p className={ERROR_BOX_CLASS + " mt-3 py-1.5"}>{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={PLACE_BUTTON_CLASS + " bg-foreground text-paper mt-4 px-5 text-sm"}
          >
            Try again
          </button>
        )}
      </div>
    </section>
  );
}
