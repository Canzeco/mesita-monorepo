"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";

// The ELEVATED save bar — status left, actions right, brand-gradient primary.
// Pairs with SectionCard's shadow-card surface; the flat config pages run
// atlas-ui's `SaveRow` (bg-foreground) instead. Which button language should
// win the console is unsettled — don't converge the two by hand.
export function SaveBar({
  pending,
  dirty,
  ok,
  onSave,
  onCancel,
  onReset,
  label = "Save changes",
  cancelLabel = "Cancel",
  resetLabel = "Reset to defaults",
  dirtyLabel,
  error,
}: {
  pending: boolean;
  dirty: boolean;
  ok: boolean;
  onSave: () => void;
  /** Revert this box to its last-saved values. Cancel only renders when given. */
  onCancel?: () => void;
  /**
   * Drop back to the code defaults. Unlike Cancel this stays live on a CLEAN
   * form — "back to defaults" is meaningful with nothing unsaved.
   */
  onReset?: () => void;
  label?: string;
  cancelLabel?: string;
  resetLabel?: string;
  /** e.g. "Basics · unsaved" — replaces generic copy when dirty. */
  dirtyLabel?: string;
  error?: string | null;
}) {
  const live = pending || dirty;

  return (
    <div className="border-border/60 mt-5 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              disabled={pending}
              className="border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              {resetLabel}
            </button>
          ) : null}
          <span className="text-xs" aria-live="polite">
            {dirty && !pending ? (
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
                {dirtyLabel ?? "Unsaved changes"}
              </span>
            ) : ok && !pending ? (
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Saved
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={pending || !dirty}
              className="border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !dirty}
            className={
              "inline-flex h-9 items-center gap-2 rounded-full px-5 text-sm font-semibold transition " +
              (live
                ? "bg-pink-gradient shadow-save text-white hover:brightness-105 active:scale-[0.98] disabled:opacity-80"
                : "bg-muted text-muted-foreground")
            }
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              label
            )}
          </button>
        </div>
      </div>
      {error ? <ErrorNote message={error} /> : null}
    </div>
  );
}
