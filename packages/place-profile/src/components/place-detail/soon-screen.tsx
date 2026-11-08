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
// menu lands here shortly." until then.
export function SoonScreen() {
  return (
    <PlaceEmptyScreen
      icon={BookOpen}
      title="Menus are coming to Mesita"
      line="We're adding menus in the next version of Mesita."
    />
  );
}
