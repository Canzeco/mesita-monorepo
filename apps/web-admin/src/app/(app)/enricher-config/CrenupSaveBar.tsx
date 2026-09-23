"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";

export function CrenupSaveBar({
  blocked,
  dirty,
  ok,
  pending,
  settingsStamp,
  error,
  onDiscard,
  onSave,
}: {
  blocked: string | null;
  dirty: boolean;
  ok: boolean;
  pending: boolean;
  settingsStamp: string | null;
  error: string | null;
  onDiscard: () => void;
  onSave: () => void;
}) {
  /* STICKY, NOT FIXED — same reason as SectionStrip: a `fixed` footer is
     measured against the window, so it ran under the desktop rail and
     sat on the phone's home indicator. Sticky still overlays the bottom
     of the column, so the modules keep `pb-24` or Vote threshold (and
     Functions) sit under Save Crenup. The row stacks under `sm`: label
     over buttons rather than three items fighting for 343px. */
  return (
    <div className="border-border bg-card/90 pb-safe sticky bottom-0 z-20 -mx-4 border-t backdrop-blur sm:-mx-6 sm:pb-0 lg:-mx-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <div className="min-w-0">
          {blocked ? (
            <p className="text-destructive m-0 text-sm font-semibold">
              Save disabled — a config failed to load
            </p>
          ) : dirty ? (
            <p className="m-0 text-sm font-semibold">
              <span className="bg-primary mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" />
              Unsaved changes
            </p>
          ) : ok ? (
            <p className="text-muted-foreground m-0 inline-flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </p>
          ) : (
            <p className="text-muted-foreground m-0 text-xs">
              {settingsStamp
                ? `Last changed ${formatShortDate(settingsStamp)}`
                : "Nothing to save"}
            </p>
          )}
        </div>
        <span className="hidden flex-1 sm:block" />
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={!dirty || pending}
            className="text-muted-foreground hover:text-foreground rounded-full px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || pending || !!blocked}
            className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 sm:px-6"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Crenup"
            )}
          </button>
        </div>
      </div>
      {error && (
        <div className="mx-auto max-w-5xl px-4 pb-3 sm:px-6">
          <ErrorNote message={error} />
        </div>
      )}
    </div>
  );
}
