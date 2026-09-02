"use client";

import { RotateCcw } from "lucide-react";

import { ErrorNote } from "@/components/ErrorNote";
import { SaveRow } from "@/components/admin-ui/config";
import { usePromosState } from "./PromosState";

// ONE Save for the whole document. Sits after the visit knobs. Distribution
// below is assumptions-only and never writes the blob.

export function PromosSaveFooter() {
  const {
    dirty,
    pending,
    ok,
    error,
    loadBlocked,
    ladderError,
    save,
    resetDefaults,
  } = usePromosState();

  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Base + class + plan, plus what the guest earned. Three visit boxes,
          one Save.
        </p>
        <button
          type="button"
          onClick={resetDefaults}
          disabled={pending}
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" />
          Launch defaults
        </button>
      </div>
      <SaveRow
        pending={pending}
        dirty={dirty && !ladderError}
        ok={ok}
        onClick={save}
        loadError={
          loadBlocked
            ? (error ?? "Failed to load Rewards config")
            : ladderError
              ? "Fix the ladder above before saving"
              : null
        }
      />
      {error && !loadBlocked && <ErrorNote message={error} />}
    </div>
  );
}
