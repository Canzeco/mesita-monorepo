"use client";

import { cn } from "@/lib/utils";

export type PlaceTab = "place" | "reviews" | "products" | "rewards";

const PLACE_TABS: Array<{ key: PlaceTab; label: string }> = [
  { key: "place", label: "Overview" },
  { key: "reviews", label: "Reviews" },
  { key: "products", label: "Products" },
  { key: "rewards", label: "Rewards" },
];

export function PlaceTabBar({
  tab,
  onChange,
}: {
  tab: PlaceTab;
  onChange: (t: PlaceTab) => void;
}) {
  return (
    // Sticky to the top of the scroll container so the tabs stay reachable
    // while the user is deep in a tab's content. Solid bg-background (no
    // translucency) so scrolled-out content can't bleed through the strip.
    <nav
      className="bg-background border-border sticky top-0 z-20 -mx-4 grid grid-cols-4 border-b px-2"
      aria-label="Place sections"
    >
      {PLACE_TABS.map((t) => {
        const active = t.key === tab;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 py-3 text-center text-[13px] font-semibold tracking-wide transition",
              active
                ? "text-foreground border-pink-500"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
