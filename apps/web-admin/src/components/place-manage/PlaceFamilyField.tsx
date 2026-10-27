"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { ChipList } from "./PlaceCategoryListFields";
import { usePlaceContext } from "./PlaceContext";

// Read-only until MESITA-2829. Families are stored, 1–5, picked by a model on
// Create and every Enrich; until then the profiles view maps the Google
// categories (MESITA-2827). The overview already named them, as
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
