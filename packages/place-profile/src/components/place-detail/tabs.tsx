"use client";

import { cn } from "../../lib/format";

// The KEYS are addresses (and map to places.products); only the LABELS are
// the words a guest reads. "Products" (Pato, MESITA-2618: "don't call it
// menu for the moment. call it products. its cleaner"). It was "Menu" from
// 2026-08-22 to 2026-10-21; he flips this word, so read the live label here.
// NO SOON IN THE STRIP (Pato, MESITA-2631: "remove the products and rewards
// soon directly it looks like shit. just when opening the view, you mention
// this is for soon"). `soon` still marks the two tabs whose screen is the
// Soon screen; the strip draws only the four labels. Rewards is the fourth
// screen. Both are the same strip on admin Preview and consumer.
// Every place has the five, Enriched or not; the Enrich vote is the top of
// Overview, never a tab of its own (MESITA-2332). BOOST IS THE FIFTH
// (MESITA-2789): anyone pays for a place's paid visibility there; the host
// app draws its body (the package holds no payment code).
export type PlaceTab = "place" | "reviews" | "products" | "rewards" | "boost";

export type PlaceTabDef = {
  key: PlaceTab;
  label: string;
  soon?: boolean;
};

const CORE_TABS = [
  { key: "place", label: "Overview" },
  { key: "reviews", label: "Reviews" },
  { key: "products", label: "Products", soon: true },
  { key: "rewards", label: "Rewards", soon: true },
  { key: "boost", label: "Boost" },
] as const satisfies ReadonlyArray<PlaceTabDef>;

export function placeTabs(): readonly PlaceTabDef[] {
  return CORE_TABS;
}

export function PlaceTabBar({
  tab,
  onChange,
}: {
  tab: PlaceTab;
  onChange: (t: PlaceTab) => void;
}) {
  const tabs = placeTabs();
  return (
    // Sticky to the top of the scroll container so the tabs stay reachable
    // while the user is deep in a tab's content. Solid bg-card (no
    // translucency) so the strip matches the name header and scrolled
    // content can't bleed through. The page wash stays below the strip.
    <nav
      className="bg-card border-border sticky top-0 z-20 -mx-4 grid grid-cols-5 border-b px-1"
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
              "type-body -mb-px flex items-center justify-center border-b-[3px] px-0.5 py-3 text-center tracking-wide transition",
              // THE SELECTED TAB IS UNMISTAKABLE (Pato, MESITA-2671: "it must
              // be a lot clearer that one screen is selected, it's too
              // light"): a 3px underline (2px until MESITA-2675) and a bold
              // label; the rest muted, medium. BLUE (Pato, MESITA-2699: "use
              // blue to highlight overview or the selected section … maybe
              // its too hidden"): blue-600, the map's guest blue and the
              // distance arrow's; it was ink like Home's Places | Social.
              active
                ? "border-blue-600 font-bold text-blue-600"
                : "text-muted-foreground hover:text-foreground border-transparent font-medium",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
