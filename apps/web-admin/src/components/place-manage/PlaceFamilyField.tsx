"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { ChipList } from "./PlaceCategoryListFields";
import { usePlaceContext } from "./PlaceContext";

// Read-only for good (MESITA-2834): a place's families are the dictionary of
// its Google categories, mapped in the profiles view; no model picks them and
// no editor saves them. The overview already named them, as
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
