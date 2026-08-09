"use client";

// Thin re-export shim — implementation lives in `@/components/admin-ui/lineup`.
// Prefer importing from `@/components/admin-ui` (or `/lineup`) in new code.

export {
  SubHead,
  Chip,
  MiniTile,
  Slider,
  PanelCard,
  BoxSection,
  ContextCols,
  EmContextCols,
  BoxSaveBar,
  CARD_ACCENTS,
  type CardTint,
} from "@/components/admin-ui/lineup";
