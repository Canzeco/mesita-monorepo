"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Undo2 } from "lucide-react";
import { type AdminPlaceClaim, decidePlaceClaim } from "./claims-actions";
import { KV, formatDate } from "./verification-ui";

export function ClaimRow({
  claim,
  onDecided,
}: {
  claim: AdminPlaceClaim;
  onDecided: (id: string, decision: "clear" | "reverse") => void;
}) {
  const [pending, startDecide] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: "clear" | "reverse") => {
    if (pending) return;
    setError(null);
    startDecide(async () => {
      const r = await decidePlaceClaim(claim.id, decision);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onDecided(claim.id, decision);
    });
  };

  return (
    <li className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold tracking-tight">
            {claim.place.name ?? "(deleted place)"}
          </p>
          <p className="text-muted-foreground text-xs">
            claimed {formatDate(claim.claimed_at)} into{" "}
            <span className="font-medium">{claim.organization?.name ?? "(deleted org)"}</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 type-meta font-bold tracking-wider text-amber-700 uppercase">
          Unreviewed
        </span>
      </div>

      <div className="border-border bg-background grid grid-cols-1 gap-3 rounded-xl border p-3 text-xs sm:grid-cols-2">
        <KV label="Place address">{claim.place.address ?? "—"}</KV>
        <KV label="Claimed by">
          {claim.claimer.full_name ?? "(no name)"}
          {claim.claimer.email ? (
            <span className="font-mono"> · {claim.claimer.email}</span>
          ) : null}
        </KV>
      </div>

      {error && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decide("clear")}
          disabled={pending}
          className="bg-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Looks right
        </button>
        <button
          type="button"
          onClick={() => decide("reverse")}
          disabled={pending}
          className="border-border text-foreground hover:bg-muted/40 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50"
        >
          <Undo2 className="h-4 w-4" />
          Reverse claim
        </button>
      </div>
    </li>
  );
}
