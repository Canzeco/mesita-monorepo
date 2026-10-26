"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { ChipList } from "./PlaceCategoryListFields";
import { usePlaceContext } from "./PlaceContext";

// Read-only. Families are derived from the Mesita categories in the profiles
// view and never inferred (MESITA-2790); the overview already named them, as
// one " · "-joined string, split here into the same chips as the category
// rows (MESITA-2810). Families keep their emoji.

export function PlaceFamilyField() {
  const { profile } = usePlaceContext();
  return (
    <ReadField label="Families" auto boxed>
      <ChipList
        items={profile.familyStored.text
          .split(" · ")
          .map((s) => s.trim())
          .filter(Boolean)}
      />
    </ReadField>
  );
}
