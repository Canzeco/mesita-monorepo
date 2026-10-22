"use client";

import { Gift, ShoppingBag, type LucideIcon } from "lucide-react";

import { PlaceEmptyScreen } from "./empty-screen";

// Products and Rewards are Soon screens (Pato, 2026-10-16). No next step.
// Products was Menu until MESITA-2618. Its glyph is a shopping bag, not a
// fork and knife (Pato, MESITA-2623: "use different icon for products").
const ICONS: Record<string, LucideIcon> = {
  Products: ShoppingBag,
  Rewards: Gift,
};

export function SoonScreen({ title }: { title: "Products" | "Rewards" }) {
  return (
    <PlaceEmptyScreen
      icon={ICONS[title]}
      title={`${title} is coming soon`}
      line={`${title} at this place lands here shortly.`}
    />
  );
}
