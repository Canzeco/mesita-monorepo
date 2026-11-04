"use client";

import { ShoppingBag } from "lucide-react";

import { PlaceEmptyScreen } from "./empty-screen";

// The Products tab's Soon screen (Pato, MESITA-2861); Rewards works since
// MESITA-3202 and has its own body. No next step. Products was Menu until MESITA-2618. Its glyph is a
// shopping bag, not a fork and knife (Pato, MESITA-2623).
export function SoonScreen() {
  return (
    <PlaceEmptyScreen
      icon={ShoppingBag}
      title="Products are coming soon"
      line="Products at this place land here shortly."
    />
  );
}
