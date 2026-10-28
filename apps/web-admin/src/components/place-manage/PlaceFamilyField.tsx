"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { PlaceFamilyPicker } from "./PlaceFamilyPicker";
import { usePlaceContext } from "./PlaceContext";

// Editable since MESITA-2893 (Pato, 2026-10-27: "the places actually save
// their family"). A place's Mesita Families are 1–5 of the thirty-seven, picked by
// the Description step's model on Create and every Enrich (MESITA-2891) and
// stored; the operator may set them here, saved with Basics through
// admin-web-update-place. A hand-set list is operator-owned: Enrich keeps it
// until the row's Reset (MESITA-2829's mark, the same as name, presentation
// and tags). Clearing the list makes the place Undefined and owns nothing.

export function PlaceFamilyField({
  value,
  onChange,
  disabled,
  labelRight,
}: {
  value: string[];
  onChange: (families: string[]) => void;
  disabled?: boolean;
  /** Basics' Reset (MESITA-2829): "Enrich keeps it · Reset" while owned. */
  labelRight?: React.ReactNode;
}) {
  const max = usePlaceContext().profile.fieldLimits.familiesPerPlaceMax;
  // Editable, so no "auto" lock; the counter sits on the label row beside
  // Reset, like Mesita presentation's (MESITA-2929).
  return (
    <ReadField
      label="Mesita families"
      boxed
      labelRight={
        <span className="inline-flex items-center gap-3">
          {labelRight}
          <span className="text-muted-foreground type-label tabular-nums" aria-live="polite">
            {value.length} / {max}
          </span>
        </span>
      }
    >
      <PlaceFamilyPicker value={value} onChange={onChange} disabled={disabled} />
    </ReadField>
  );
}
