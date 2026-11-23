"use client";

import { useState } from "react";
import { MapPin, MapPinOff } from "lucide-react";
import { LocationModal } from "@/components/consumer/home/LocationModal";
import type { PickerTarget } from "@/components/consumer/home/LocationChooser";
import { HOME_LOCATION_CLASS, HOME_LOCATION_OFF_CLASS, NO_LOCATION_LABEL } from "@/components/consumer/home/LocationPicker";
import { useActiveLocation } from "@/lib/active-location";
import { useUserLocation, useUserLocationLocating, useUserLocationSettled } from "@/lib/use-user-location";
import { cn } from "@/lib/utils";

// THE LIST'S LOCATION BOX (Pato, 2026-11-23, MESITA-4748: "at the top right
// add location like in home, that location implies that places are sorted
// from closest to not closest"; /plan-design-review D7): Home's grey box in
// the Prepay and Explore Offers header, opening Home's location modal. The
// list sorts from what it names. It replaces the "Use my location / Not now"
// card those lists showed. "Near me" for the phone's own fix (Home's
// "Current location" does not fit beside a centred title), no chevron, at
// Home's size (16px, 18px pin; MESITA-4749). Where the words cannot fit beside
// the title the box is the pin alone (the words stay for a screen reader):
// under 360px on Prepay, under 430px beside the longer "Explore Offers".

/** What the box says. */
export function listLocationLabel(
  active: { name: string } | null,
  hasFix: boolean,
  locating: boolean,
  settled: boolean,
): { label: string; off: boolean } {
  if (active) return { label: active.name, off: false };
  if (hasFix) return { label: "Near me", off: false };
  if (locating) return { label: "Locating…", off: false };
  if (settled) return { label: NO_LOCATION_LABEL, off: true };
  return { label: "Set location", off: false };
}

/** Below this width the box drops its words (the title beside it decides). */
const LABEL_HIDDEN = { short: "max-[359px]:sr-only", long: "max-[429px]:sr-only" } as const;

export function ListLocationBox({ title = "short" }: { title?: keyof typeof LABEL_HIDDEN }) {
  const active = useActiveLocation();
  const coords = useUserLocation();
  const locating = useUserLocationLocating();
  const settled = useUserLocationSettled();
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const { label, off } = listLocationLabel(active, coords !== null, locating, settled);
  const Pin = off ? MapPinOff : MapPin;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Places sorted from: ${label}. Change location`}
        className={cn(HOME_LOCATION_CLASS, "max-w-full", off && HOME_LOCATION_OFF_CLASS)}
        data-list-location
      >
        <Pin className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
        <span className={cn("min-w-0 truncate", LABEL_HIDDEN[title])}>{label}</span>
      </button>
      <LocationModal
        open={open}
        onClose={() => {
          setOpen(false);
          setPicker(null);
        }}
        picker={picker}
        onPickerChange={setPicker}
      />
    </>
  );
}
