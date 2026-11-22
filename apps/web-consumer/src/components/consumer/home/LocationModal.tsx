"use client";

import { X } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { LocationChooser, type PickerTarget } from "./LocationChooser";

// THE LOCATION MODAL FLOATS (Pato, 2026-11-21, MESITA-4628: "location must
// not be a [bottom sheet] like that, it must be a centered floating modal …
// with floating modal I mean this", over the Categories modal). The app's
// floating card, as Categories (MESITA-4433): 20px in from every edge,
// rounded, over the dimmed screen; it scales in. A header with "Location"
// and an X; the search and the rows under it, the rows edge to edge inside
// the card (no box inside a box). Adding or editing a pin grows the card to
// the full height so the map has room; there the backdrop and Escape act as
// Back. Both doors open it: Home's location button (LocationPicker) and the
// app-wide gate (LocationGate). It replaced a bottom sheet (MESITA-4589).
export function LocationModal({
  open,
  onClose,
  picker,
  onPickerChange,
}: {
  open: boolean;
  onClose: () => void;
  picker: PickerTarget | null;
  onPickerChange: (next: PickerTarget | null) => void;
}) {
  const pinStep = picker !== null;
  return (
    <LocalDialog
      open={open}
      onClose={pinStep ? () => onPickerChange(null) : onClose}
      ariaLabel="Location"
      fit={!pinStep}
      scroll={pinStep}
    >
      {pinStep ? null : (
        <header className="border-border flex h-14 shrink-0 items-center border-b pr-1.5 pl-5">
          <h2 className="text-foreground flex-1 text-base font-semibold">Location</h2>
          <button
            type="button"
            aria-label="Close location"
            onClick={onClose}
            className="text-foreground hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full transition"
          >
            <X className="h-6 w-6" strokeWidth={2.25} />
          </button>
        </header>
      )}
      <LocationChooser
        onDone={onClose}
        picker={picker}
        onPickerChange={onPickerChange}
        flush
        bodyClassName="scrollbar-thin-dark min-h-0 flex-1 overflow-y-auto p-5"
      />
    </LocalDialog>
  );
}
