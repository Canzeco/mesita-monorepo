import { CheckCircle2 } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { Button } from "./button";
import { Notice } from "./notice";

/** Save is allowed only when something changed, nothing is in flight and every config loaded. */
export function canSave({
  dirty,
  pending,
  loadError,
}: {
  dirty: boolean;
  pending: boolean;
  loadError?: string | null;
}): boolean {
  return dirty && !pending && !loadError;
}

/**
 * The sticky save strip for a page with one save across many cards (Crenup).
 * Sticky, not fixed: a fixed footer is measured against the window, so it ran
 * under the desktop rail. The host page reserves `pb-24` so the strip never
 * covers the last card. Four states: blocked, dirty, saved, clean.
 */
export function SaveBar({
  loadError,
  dirty,
  ok,
  pending,
  lastChanged,
  error,
  onDiscard,
  onSave,
}: {
  /** When set, Save stays disabled: never overwrite a config that failed to load (MESITA-737). */
  loadError: string | null;
  dirty: boolean;
  ok: boolean;
  pending: boolean;
  /** ISO stamp of the last save, for the clean state. */
  lastChanged: string | null;
  error: string | null;
  onDiscard?: () => void;
  onSave: () => void;
}) {
  const allowed = canSave({ dirty, pending, loadError });
  return (
    <div className="border-border bg-card/90 pb-safe sticky bottom-0 z-20 -mx-4 border-t backdrop-blur sm:-mx-6 sm:pb-0 lg:-mx-8">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          {loadError ? (
            <p className="text-destructive m-0 text-sm font-semibold">
              Save disabled — a config failed to load
            </p>
          ) : dirty ? (
            <p className="m-0 text-sm font-semibold">
              <span aria-hidden className="bg-foreground mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" />
              Unsaved changes
            </p>
          ) : ok ? (
            <p className="text-muted-foreground m-0 inline-flex items-center gap-1.5 text-sm">
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
              Saved
            </p>
          ) : (
            <p className="text-muted-foreground m-0 text-sm">
              {lastChanged ? `Last changed ${formatShortDate(lastChanged)}` : "Nothing to save"}
            </p>
          )}
        </div>
        <span className="hidden flex-1 sm:block" />
        <div className="flex shrink-0 items-center justify-end gap-3">
          {onDiscard ? (
            <Button tone="ghost" onClick={onDiscard} disabled={!dirty || pending}>
              Discard
            </Button>
          ) : null}
          <Button
            pending={pending}
            disabled={!allowed}
            onClick={() => {
              if (canSave({ dirty, pending, loadError })) onSave();
            }}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {error ? (
        <div className="px-4 pb-3 sm:px-6 lg:px-8">
          <Notice>{error}</Notice>
        </div>
      ) : null}
    </div>
  );
}
