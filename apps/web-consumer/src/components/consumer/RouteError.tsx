"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";

import { reportError } from "@/lib/report-error";
import { recoverFromStaleBuild } from "@/lib/stale-build";

// THE SCREEN A BROKEN ROUTE LANDS ON (MESITA-2993). Without it a throw
// during navigation left Next's bare "Application error" page, and only a
// manual reload got out. First it tries to heal: an old build reloads onto
// the live one (src/lib/stale-build.ts). Otherwise it says so plainly and
// offers Try again (re-fetch this screen) and Reload (the whole app). Inside
// the shell the tab bar stays, so another tab is one tap away too.

export function RouteError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  // Hold the screen blank while the stale-build check runs, so a reload
  // does not flash the error first.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    console.error("[consumer/route-error]", error);
    let live = true;
    void recoverFromStaleBuild(error).then((reloading) => {
      if (!live || reloading) return;
      setChecking(false);
      // The screen says it failed; the notification says why (MESITA-3021).
      const why = error instanceof Error ? error.message : "";
      reportError(
        why ? `This screen didn't load: ${why}` : "This screen didn't load.",
        error,
      );
    });
    return () => {
      live = false;
    };
  }, [error]);

  if (checking) return <div className="flex-1" aria-busy />;

  return (
    <div
      role="alert"
      className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"
    >
      <h1 className="font-display text-xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
        This screen didn&apos;t load. Try again, or reload Mesita.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={retry}
          className="bg-foreground text-paper rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="border-border bg-card inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold"
        >
          <RotateCw className="h-4 w-4" />
          Reload
        </button>
      </div>
    </div>
  );
}
