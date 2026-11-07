"use client";

import { BookOpen } from "lucide-react";

import { PlaceEmptyScreen } from "./empty-screen";

// The Menu tab's Soon screen (Pato, MESITA-2861); Vouchers has its own
// body. No next step. The tab is Menu again since MESITA-3318 (Products
// from MESITA-2618 until then); its glyph is an open menu, not a fork and
// knife (Pato, MESITA-2623) and not the shopping bag Products wore.
export function SoonScreen() {
  return (
    <PlaceEmptyScreen
      icon={BookOpen}
      title="The menu is coming soon"
      line="This place's menu lands here shortly."
    />
  );
}
