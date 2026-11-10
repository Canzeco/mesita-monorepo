"use client";

// A guest pays for this place's plan, and the place may stop it (MESITA-3103).
// Back on Premier since MESITA-3620 (Billing folded in).

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/shell/Page";
import { cancelPremier } from "@/lib/business-api";

export function StopGuestPlan({ placeId, until }: { placeId: string; until: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function stop() {
    setBusy(true);
    setError(null);
    setArmed(false);
    const r = await cancelPremier(placeId, true);
    setBusy(false);
    if (!r.ok) setError(r.error);
    else router.refresh();
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-sm">
        <p className="text-muted-foreground min-w-0 flex-1">A guest pays for this plan until {until}.</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => (armed ? void stop() : setArmed(true))}
          onBlur={() => setArmed(false)}
          className="border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
        >
          {armed ? "Tap again to stop it" : "Stop it"}
        </button>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </Card>
  );
}
