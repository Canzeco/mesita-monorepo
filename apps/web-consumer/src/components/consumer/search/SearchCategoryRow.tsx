"use client";

import { PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";
import { toggleMapFamily } from "@/lib/use-map-filters";
import { cn } from "@/lib/utils";

// Category on the Search map — the six Mesita families as a chip strip
// under the query row. Super Category is this same axis; the guest word
// is Category. Concrete catalog / Google types stay off the canvas.
// Short labels so the strip scrolls instead of wrapping. No emoji.

const CATEGORY_STRIP: Record<FamilyKey, string> = {
  restaurants: "Restaurants",
  bars_nightlife: "Bars",
  cafes_bakeries: "Cafés",
  wellness_spa: "Wellness",
  experiences: "Experiences",
  culture_arts: "Culture",
};

export function SearchCategoryRow({
  familyKeys,
}: {
  familyKeys: readonly FamilyKey[];
}) {
  return (
    <div
      className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-0.5"
      role="toolbar"
      aria-label="Category"
    >
      {PLACE_FAMILIES.map((family) => {
        const active = familyKeys.includes(family.key);
        return (
          <button
            key={family.key}
            type="button"
            onClick={() => toggleMapFamily(family.key)}
            aria-pressed={active}
            aria-label={family.label}
            className={cn(
              "type-label flex h-8 shrink-0 items-center rounded-full px-2.5 font-semibold whitespace-nowrap backdrop-blur transition active:scale-[0.97]",
              active
                ? "bg-pink-gradient text-white shadow-glow-sm"
                : "bg-card/95 text-foreground/80 shadow-rest",
            )}
          >
            {CATEGORY_STRIP[family.key]}
          </button>
        );
      })}
    </div>
  );
}
