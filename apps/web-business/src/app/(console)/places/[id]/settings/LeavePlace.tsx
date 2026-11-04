"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { leavePlace } from "@/lib/business-api";
import { PLACES } from "@/lib/routes";

export function LeavePlace({ placeId }: { placeId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div className="min-w-0 flex-1">
        <p>Remove this place from my account</p>
        {error ? <p className="text-destructive">{error}</p> : null}
      </div>
      <button
        type="button"
        disabled={busy}
        onBlur={() => setArmed(false)}
        onClick={async () => {
          if (!armed) return setArmed(true);
          setBusy(true);
          const r = await leavePlace(placeId);
          setBusy(false);
          if (!r.ok) return setError(r.code === "transfer_first" ? "Make an editor the owner before you leave." : r.error);
          router.push(PLACES);
          router.refresh();
        }}
        className="border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
      >
        {armed ? "Tap to confirm" : "Remove"}
      </button>
    </>
  );
}
