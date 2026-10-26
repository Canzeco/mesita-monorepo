"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { usePlaceContext } from "./PlaceContext";

// Read-only. Families are derived from the Mesita categories in the profiles
// view and never inferred (MESITA-2790); the overview already named them.

export function PlaceFamilyField() {
  const { profile } = usePlaceContext();
  return (
    <ReadField label="Families" auto boxed>
      {profile.familyStored.text}
    </ReadField>
  );
}
