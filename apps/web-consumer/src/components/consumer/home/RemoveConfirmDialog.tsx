"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";

// Confirm before unsaving — one tap opens this, a second (Yes) actually
// removes. `place` null-gates the open state so the exit transition still runs.
//
// Only the REMOVE direction is confirmed. Saving from the suggestions strip is
// one tap with no dialog: it's the non-destructive direction, and an undo toast
// covers the stray tap.
export function RemoveConfirmDialog({
  place,
  onCancel,
  onConfirm,
}: {
  place: Place | null;
  onCancel: () => void;
  onConfirm: (place: Place) => void;
}) {
  // Hold the last place through the close so the panel doesn't blank mid-exit.
  const [shown, setShown] = useState<Place | null>(place);
  if (place && place !== shown) setShown(place);

  return (
    <LocalDialog
      open={place != null}
      onClose={onCancel}
      ariaLabel="Remove from saved"
    >
      <div className="flex flex-col p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10">
          <Heart className="h-6 w-6 fill-rose-500 text-rose-500" />
        </div>
        <h3 className="font-display mt-3 text-lg font-semibold tracking-tight">
          Remove from saved?
        </h3>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {shown?.name
            ? `“${shown.name}” will be removed from your saved places.`
            : "This place will be removed from your saved places."}
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="border-border bg-card hover:bg-muted flex-1 rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98]"
          >
            No
          </button>
          <button
            type="button"
            onClick={() => shown && onConfirm(shown)}
            className="flex-1 rounded-xl bg-rose-500 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 active:scale-[0.98]"
          >
            Yes, remove
          </button>
        </div>
      </div>
    </LocalDialog>
  );
}
