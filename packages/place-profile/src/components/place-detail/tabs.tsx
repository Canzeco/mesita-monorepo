"use client";

import { cn } from "../../lib/format";

// The KEYS are addresses (and map to places.products); only the LABELS are
// the words a guest reads. "Products" (Pato, MESITA-2618: "don't call it
// menu for the moment. call it products. its cleaner"). It was "Menu" from
// 2026-08-22 to 2026-10-21; he flips this word, so read the live label here.
// decision: Pato (2026-10-16) — Products and Rewards wear Soon. Rewards is the
// fourth screen. Both are the same strip on admin Preview and consumer.
// Every place has the four, Enriched or not; the Enrich vote is the top of
// Overview, never a tab of its own (MESITA-2332).
export type PlaceTab = "place" | "reviews" | "products" | "rewards";

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
      className="bg-card border-border sticky top-0 z-20 -mx-4 grid grid-cols-4 border-b px-1"
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
              "type-body -mb-px flex flex-col items-center justify-end gap-0.5 border-b-2 px-0.5 pt-1.5 pb-2.5 text-center font-semibold tracking-wide transition",
              active
                ? "text-foreground border-border"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            <span
              aria-hidden={t.soon ? undefined : true}
              className={cn(
                "type-meta bg-muted text-muted-foreground rounded-full px-1.5 leading-none font-semibold",
                t.soon ? "visible" : "invisible",
              )}
            >
              Soon
            </span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
