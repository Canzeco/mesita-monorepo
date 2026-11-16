"use client";

import { BookOpen } from "lucide-react";

import { PlaceEmptyScreen } from "./empty-screen";

// The Menu tab's Soon screen (Pato, MESITA-2861); Vouchers has its own
// body. No next step. The tab is Menu again since MESITA-3318 (Products
// from MESITA-2618 until then); its glyph is an open menu, not a fork and
// knife (Pato, MESITA-2623) and not the shopping bag Products wore.
// ABOUT MESITA, NEVER THE PLACE (Pato, MESITA-3415: "mention more not like
// this place doesn't have a menu. but mention that mesita will launch menu
// for the next version"): it read "The menu is coming soon / This place's
// menu lands here shortly." until then. "Smart menus" since MESITA-3989
// (Pato: "we are adding smart menus"). "Order & Pay" since MESITA-4175
// (Pato: "table orders and pickup orders … not delivery orders"): it names
// both kinds and says plainly there is no delivery.
export function SoonScreen() {
  return (
    <PlaceEmptyScreen
      icon={BookOpen}
      title="Order & Pay is coming to Mesita"
      line="Order and pay from the menu at your table, or order ahead and pick it up. Pickup only, no delivery."
    />
  );
}
