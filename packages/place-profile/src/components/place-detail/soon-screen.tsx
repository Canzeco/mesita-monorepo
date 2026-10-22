"use client";

import { Gift, ShoppingBag, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/format";
import { PLACE_SCREEN_TITLE_CLASS } from "../../lib/ui";

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
      {/* The place scale (MESITA-2636): a grey chip with an ink glyph, an
          Inter title, a 14px muted line. */}
      <span className="bg-muted text-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
        <Icon className="h-7 w-7" strokeWidth={2} />
      </span>
      <h3 className={cn(PLACE_SCREEN_TITLE_CLASS, "mt-4")}>
        {title} is coming soon
      </h3>
      <p className="text-muted-foreground mt-1.5 max-w-[30ch] text-sm leading-relaxed">
        {title} at this place lands here shortly.
      </p>
    </div>
  );
}
