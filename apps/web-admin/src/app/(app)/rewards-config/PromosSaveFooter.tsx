"use client";

import { usePathname } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { ErrorNote } from "@/components/ErrorNote";
import { SaveRow } from "../enricher-config/atlas-ui";
import { usePromosState } from "./PromosState";

// ONE Save for the whole document, mounted by the layout so it persists across
// the Visits/Orders tabs. Both subpages edit the same blob; a per-tab Save
// would let one revert the other's unsaved edits (D5).
//
// Distribution is READ-ONLY — it simulates the saved config and edits nothing,
// so it gets no Save bar. A disabled Save on a page with no inputs is a
// control that does not belong to it.
export function PromosSaveFooter() {
  const pathname = usePathname();
  const editable = pathname?.startsWith("/rewards-config/tiers");

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

  if (!editable) return null;

  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Rates are built from components: base + class + plan, plus whatever the
          guest earned. Class is earned or invited, never sold — this page
          prices the rungs, it does not seat anyone on them. All four tiers
          share one Save.
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
            ? (error ?? "Failed to load Promos config")
            : ladderError
              ? "Fix the ladder above before saving"
              : null
        }
      />
      {error && !loadBlocked && <ErrorNote message={error} />}
    </div>
  );
}
