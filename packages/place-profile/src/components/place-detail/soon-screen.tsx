"use client";

import { ShoppingBag } from "lucide-react";

import { PlaceEmptyScreen } from "./empty-screen";

// The Products tab is the one Soon screen, and it speaks for Rewards too
// (Pato, MESITA-2861: "for the moment call Products & Rewards coming
// soon"). No next step. Products was Menu until MESITA-2618. Its glyph is a
// shopping bag, not a fork and knife (Pato, MESITA-2623).
export function SoonScreen() {
  return (
    <PlaceEmptyScreen
      icon={ShoppingBag}
      title="Products & Rewards are coming soon"
      line="Products and rewards at this place land here shortly."
    />
  );
}
