"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { usePlaceContext } from "./PlaceContext";
import { shownFamily } from "./profile-family-display";

// Read-only. The overview resolved the string from the Google category's
// live family mapping; this only paints it.

export function PlaceFamilyField() {
  const { place, profile } = usePlaceContext();
  const display = shownFamily(place.category ?? "", place.category, profile);

  return (
    <ReadField label="Mesita families" auto boxed>
      <span aria-label={`Mesita families: ${display.text}`}>
        <span aria-hidden>{display.text}</span>
        {display.inferred ? (
          <span className="text-muted-foreground/70"> (inferred)</span>
        ) : null}
      </span>
    </ReadField>
  );
}
