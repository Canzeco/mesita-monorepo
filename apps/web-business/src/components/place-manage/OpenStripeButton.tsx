"use client";

// Open Stripe (MESITA-4554, Pato: "open stripe must be at top right"): a quiet
// grey button in the Payments card's title row, one-time link into the place's
// Stripe dashboard for bank details, documents and tax forms.
import { useState } from "react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr";
import { openPaymentDashboard } from "@/lib/business-api";

export function OpenStripeButton({ placeId }: { placeId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
      <button
        type="button"
        className="bg-muted text-foreground hover:bg-muted/70 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await openPaymentDashboard(placeId);
          setBusy(false);
          if (r.ok) window.open(r.data.url, "_blank", "noopener,noreferrer");
          else setError(r.error);
        }}
      >
        {busy ? "Opening…" : "Open Stripe"}
        <ArrowSquareOutIcon size={14} weight="bold" aria-hidden />
      </button>
    </span>
  );
}
