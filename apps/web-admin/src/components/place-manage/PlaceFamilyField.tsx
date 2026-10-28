"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { ChipList } from "./PlaceCategoryListFields";
import { usePlaceContext } from "./PlaceContext";

// Read-only (MESITA-2891): a place's Mesita Families are 1–5 picked by the
// Description step's model on Create and every Enrich, and stored; no editor
// saves them. The overview already named them, as
// one " · "-joined string, split here into the same chips as the category
// rows (MESITA-2810). Families keep their emoji.

export function PlaceFamilyField() {
  const { profile } = usePlaceContext();
  return (
    <ReadField label="Mesita families" auto boxed>
      <ChipList
        items={profile.familyStored.text
          .split(" · ")
          .map((s) => s.trim())
          .filter(Boolean)}
      />
    </ReadField>
  );
}
