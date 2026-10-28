"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { PlaceFamilyPicker } from "./PlaceFamilyPicker";

// Editable since MESITA-2893 (Pato, 2026-10-27: "the places actually save
// their family"). A place's Mesita Families are 1–5 of the forty, picked by
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
  return (
    <ReadField label="Mesita families" auto boxed labelRight={labelRight}>
      <PlaceFamilyPicker value={value} onChange={onChange} disabled={disabled} />
    </ReadField>
  );
}
