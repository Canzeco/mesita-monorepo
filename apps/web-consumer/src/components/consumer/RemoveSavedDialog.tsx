"use client";

import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";

// REMOVING FROM SAVED ASKS FIRST (Pato, 2026-11-22, MESITA-4676: "add
// verification modal to remove place from saved"). Home's cards, Search's
// map card and the place screen's Saved tile all ask here before a saved
// place leaves Saved; saving still happens at once. A plain two-button
// confirm, no font-loading card, so Home's and Search's modules stay light.
export function RemoveSavedDialog({
  name,
  onConfirm,
  onCancel,
}: {
  /** The place waiting for a yes; null when closed. */
  name: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <LocalDialog open={name !== null} onClose={onCancel} ariaLabel="Remove from Saved?">
      <div className="p-5" data-remove-saved>
        <p className="text-foreground text-lg font-semibold">Remove from Saved?</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {name ? `${name} will leave your Saved places.` : "This place will leave your Saved places."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border-border bg-card text-foreground hover:bg-muted h-12 rounded-full border text-base font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-foreground text-background h-12 rounded-full text-base font-semibold transition hover:opacity-90"
          >
            Remove
          </button>
        </div>
      </div>
    </LocalDialog>
  );
}
