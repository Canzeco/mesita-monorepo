"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { usePlaceContext } from "./PlaceContext";
import { shownFamily } from "./profile-family-display";

// Read-only. The overview resolved the string; a draft category change
// swaps in the display that same response attached to the chosen option.

export function PlaceFamilyField({ category }: { category: string }) {
  const { place, profile } = usePlaceContext();
  const display = shownFamily(category, place.category, profile);

  return (
    <ReadField label="Family" auto boxed>
      <span aria-label={`Family: ${display.text}`}>
        <span aria-hidden>{display.text}</span>
        {display.inferred ? (
          <span className="text-muted-foreground/70"> (inferred)</span>
        ) : null}
      </span>
    </ReadField>
  );
}
