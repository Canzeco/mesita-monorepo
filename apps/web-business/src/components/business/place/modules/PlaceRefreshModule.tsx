"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlaceRefreshModule({
  running,
  notice,
  onRefresh,
}: {
  running: boolean;
  notice: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onRefresh}
        disabled={running}
        aria-busy={running}
        className={cn(
          "inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border text-[13px] font-semibold transition",
          running
            ? "text-muted-foreground cursor-wait"
            : "hover:bg-muted/50",
        )}
      >
        {running ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Refreshing…
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />
            Refresh from web
          </>
        )}
      </button>
      {notice ? (
        <p className="text-secondary text-center text-[11px] font-medium">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
