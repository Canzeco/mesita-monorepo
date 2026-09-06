"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { usePlaceContext } from "./PlaceContext";

/**
 * The page's ONE save.
 *
 * It replaces the per-card SaveBars that used to sit inside Basics, Hours,
 * Channels, Photos, Menus, Orders and Reservations — seven footers asking the
 * same question, each answerable only by finding the amber dot inside the card
 * you happened to edit. Here the answer is one line, in one place, and it names
 * WHICH boxes are unsaved rather than just asserting that something is.
 *
 * It floats rather than sitting at the bottom of the document because the
 * Profile tab is a masonry column taller than the viewport: a save pinned to
 * the end of the content is a save you have to go looking for. Sticky-bottom
 * keeps it reachable from wherever you are in the form, and it only exists
 * while there is something to save — a permanent bar on a clean page is chrome
 * that never earns its pixels.
 *
 * Rendered once by the place layout, so every tab gets it without any tab
 * knowing it exists.
 */
export function PlaceSaveBar() {
  const {
    isDirty,
    dirtyLabels,
    savePending,
    saveError,
    saveOk,
    saveAll,
    requestDiscard,
  } = usePlaceContext();

  // Nothing to say: no unsaved work, no save in flight, and no failure still
  // waiting to be read.
  if (!isDirty && !savePending && !saveError && !saveOk) return null;

  const count = dirtyLabels.length;

  return (
    <div
      className="pointer-events-none sticky inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:pb-6"
      // The bar sits above the home indicator on a phone; without this it
      // overlaps the gesture area and the last card underneath it.
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="border-border bg-card shadow-elev pointer-events-auto flex w-full max-w-2xl flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center sm:gap-4 sm:rounded-full sm:py-2.5 sm:pr-2.5 sm:pl-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5" aria-live="polite">
          {savePending ? (
            <>
              <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
              <span className="text-sm font-semibold">Saving…</span>
            </>
          ) : saveOk && !isDirty ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              <span className="text-sm font-semibold">Saved</span>
            </>
          ) : (
            <>
              <span
                className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="text-sm font-semibold">
                  {count} unsaved
                </span>
                {count > 0 ? (
                  <span className="text-muted-foreground ml-2 truncate text-xs">
                    {dirtyLabels.join(", ")}
                  </span>
                ) : null}
              </span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={requestDiscard}
            disabled={savePending || !isDirty}
            className="border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={savePending || !isDirty}
            className="bg-pink-gradient shadow-save inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
          >
            {savePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </div>

      {saveError ? (
        <div className="pointer-events-auto absolute inset-x-4 bottom-full mb-2 flex justify-center">
          <div className="border-border bg-card shadow-card w-full max-w-2xl rounded-xl border px-4 py-2">
            <ErrorNote message={saveError} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
