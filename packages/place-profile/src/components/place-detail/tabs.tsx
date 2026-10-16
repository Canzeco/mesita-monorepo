"use client";

import { cn } from "../../lib/format";

// The KEYS are addresses (and map to places.products); only the LABELS are
// the words a guest reads. "Menus", never "Products" (Pato 2026-08-22).
// Enrich is first and only while the place is not Enriched (MESITA-1364).
// decision: Pato (2026-10-16) — Menus and Rewards wear Soon. Rewards is the
// fourth screen. Both are the same strip on admin Preview and consumer.
export type PlaceTab = "enrich" | "place" | "reviews" | "products" | "rewards";

export type PlaceTabDef = {
  key: PlaceTab;
  label: string;
  soon?: boolean;
};

const CORE_TABS = [
  { key: "place", label: "Overview" },
  { key: "reviews", label: "Reviews" },
  { key: "products", label: "Menus", soon: true },
  { key: "rewards", label: "Rewards", soon: true },
] as const satisfies ReadonlyArray<PlaceTabDef>;

const ENRICH_TAB = { key: "enrich", label: "Enrich" } as const satisfies PlaceTabDef;

export function placeTabs(enriched: boolean): readonly PlaceTabDef[] {
  // Unenriched: Enrich only. The four screens wait until the place is
  // Enriched (Pato, live 2026-08-29).
  return enriched ? CORE_TABS : [ENRICH_TAB];
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
        "bg-background border-border sticky top-0 z-20 -mx-4 grid border-b px-1",
        enriched ? "grid-cols-4" : "grid-cols-1",
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
              "type-body -mb-px flex flex-col items-center justify-end gap-0.5 border-b-2 px-0.5 pt-1.5 pb-2.5 text-center font-semibold tracking-wide transition",
              active
                ? "text-foreground border-border"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {enriched && (
              <span
                aria-hidden={t.soon ? undefined : true}
                className={cn(
                  "type-meta bg-muted text-muted-foreground rounded-full px-1.5 leading-none font-semibold",
                  t.soon ? "visible" : "invisible",
                )}
              >
                Soon
              </span>
            )}
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
