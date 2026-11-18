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
// both kinds and says plainly there is no delivery. "Smart Menu" and what
// it does since MESITA-4177 (Pato: "mention capabilities of Smart menu";
// the capabilities are his from MESITA-3244: interactive, hosted in
// Mesita, AI answers questions, orders and payments in place or remote).
// Three short lines, not a paragraph, since MESITA-4182 (Pato: "more
// concise … ask the menu questions, calories … order & pay … table orders
// … pickup orders"). The title is "Smart Menu" alone since MESITA-4314
// (Pato: "don't mention Smart Menu coming to Mesita").
// Two lines, no orders, since MESITA-4339 (Pato, 2026-11-18: "be more
// concise … Smart Menu is coming to mesita. Don't mention orders yet …
// like ask ai and calories … don't mention allergens"): it says coming to
// Mesita again, by his word, and only the asking.
// Table orders back in the second line since MESITA-4389 (Pato, 2026-11-18:
// "Order and pay from you table and ask …"): table only, no pickup or
// delivery. A visual-menu line too (Pato: "graphical menu … beautiful
// images and videos"; the screen signals what is coming, for investors
// who audit the app, so it may promise a little ahead).
export function SoonScreen() {
  return (
    <PlaceEmptyScreen
      icon={BookOpen}
      title="Smart Menu"
      items={[
        "Smart Menu is coming to Mesita.",
        "A visual menu with beautiful photos and videos of every dish.",
        "Order and pay from your table, and ask AI about any dish: calories, ingredients and more.",
      ]}
    />
  );
}
