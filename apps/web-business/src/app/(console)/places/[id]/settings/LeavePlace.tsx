"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { leavePlace } from "@/lib/business-api";

export function LeavePlace({ placeId }: { placeId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
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
          router.push("/places");
          router.refresh();
        }}
        className="border-border hover:bg-muted h-9 w-fit rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
      >
        {armed ? "Tap again to remove it" : "Remove this place from my account"}
      </button>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
