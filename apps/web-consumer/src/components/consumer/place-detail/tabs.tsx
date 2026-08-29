"use client";

import { cn } from "@/lib/utils";

// The KEYS are addresses (and map to places.products); only the LABELS are
// the words a guest reads. "Menus", never "Products" (Pato 2026-08-22).
// Enrich is first and only while the place is not Enriched (MESITA-1364).
export type PlaceTab = "enrich" | "place" | "reviews" | "products" | "rewards";

const CORE_TABS = [
  { key: "place", label: "Overview" },
  { key: "reviews", label: "Reviews" },
  { key: "products", label: "Menus" },
  { key: "rewards", label: "Rewards" },
] as const satisfies ReadonlyArray<{ key: PlaceTab; label: string }>;

const ENRICH_TAB = { key: "enrich", label: "Enrich" } as const;

export function placeTabs(enriched: boolean): readonly { key: PlaceTab; label: string }[] {
  return enriched ? CORE_TABS : [ENRICH_TAB, ...CORE_TABS];
}

export function PlaceTabBar({
  tab,
  onChange,
  enriched,
}: {
  tab: PlaceTab;
  onChange: (t: PlaceTab) => void;
  enriched: boolean;
}) {
  const tabs = placeTabs(enriched);
  return (
    // Sticky to the top of the scroll container so the tabs stay reachable
    // while the user is deep in a tab's content. Solid bg-background (no
    // translucency) so scrolled-out content can't bleed through the strip.
    <nav
      className={cn(
        "bg-background border-border sticky top-0 z-20 -mx-4 grid border-b px-2",
        enriched ? "grid-cols-4" : "grid-cols-5",
      )}
      aria-label="Place sections"
    >
      {tabs.map((t) => {
        const active = t.key === tab;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "type-body -mb-px border-b-2 py-3 text-center font-semibold tracking-wide transition",
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
