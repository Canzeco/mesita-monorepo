"use client";

import { Gift, ShoppingBag, type LucideIcon } from "lucide-react";

// Products and Rewards are Soon screens (Pato, 2026-10-16). No next step.
// Products was Menu until MESITA-2618. Its glyph is a shopping bag, not a
// fork and knife (Pato, MESITA-2623: "use different icon for products").
const ICONS: Record<string, LucideIcon> = {
  Products: ShoppingBag,
  Rewards: Gift,
};

export function SoonScreen({ title }: { title: "Products" | "Rewards" }) {
  const Icon = ICONS[title];
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-2xl">
        <Icon className="h-7 w-7" strokeWidth={2} />
      </span>
      <h3 className="font-display text-foreground mt-4 text-lg font-semibold tracking-tight">
        {title} is coming soon
      </h3>
      <p className="text-muted-foreground mt-1.5 max-w-[30ch] text-sm leading-relaxed">
        {title} at this place lands here shortly.
      </p>
    </div>
  );
}
