"use client";

import { ShoppingBag } from "lucide-react";

import { PlaceEmptyScreen } from "./empty-screen";

// The Products and Rewards tabs share this one Soon screen (Pato, MESITA-2861:
// "for the moment call Products & Rewards coming soon"; Rewards its own tab
// again since MESITA-3201). No next step. Products was Menu until MESITA-2618. Its glyph is a
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
