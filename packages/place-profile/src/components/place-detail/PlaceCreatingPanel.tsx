"use client";

import { AlertCircle } from "lucide-react";

import { ERROR_BOX_CLASS } from "../../lib/ui";
import { Spinner } from "../Spinner";

// The Enrich slot while a Google-only profile is being created
// (MESITA-2307): the guest sees Google's profile at once, and this panel
// says Mesita is saving it. Nothing to vote on yet — the place is not on
// Mesita until the create lands; then the real profile takes over.
export function PlaceCreatingPanel({ error }: { error: string | null }) {
  return (
    <section
      className="border-border bg-card shadow-elev overflow-hidden rounded-2xl border"
      data-creating={error ? "failed" : "creating"}
    >
      <div className="from-primary/12 via-primary/6 to-card bg-gradient-to-b px-5 pb-6 pt-6 text-center">
        <span className="bg-primary/15 text-primary mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
          {error ? (
            <AlertCircle className="h-7 w-7" strokeWidth={2} />
          ) : (
            <Spinner size="lg" label="Creating profile" />
          )}
        </span>
        <h3 className="font-display mt-4 text-xl font-semibold tracking-tight">
          {error ? "Couldn't create this profile" : "Creating profile"}
        </h3>
        {error ? (
          <p className={`${ERROR_BOX_CLASS} mx-auto mt-3 max-w-[36ch] text-left`}>
            {error}
          </p>
        ) : (
          <p className="text-muted-foreground mx-auto mt-2 max-w-[32ch] text-sm leading-relaxed">
            A few seconds. Google&apos;s profile is on screen while Mesita
            saves it; the Enrich vote opens right after.
          </p>
        )}
      </div>
    </section>
  );
}
