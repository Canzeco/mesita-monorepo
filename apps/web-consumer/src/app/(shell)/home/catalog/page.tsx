"use client";

import { CatalogGrid } from "@/components/consumer/home/CatalogGrid";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Catalog — the shared Home deck as a browsable grid (Pato, 2026-08-26).
// Same fetch as Swipe / Favorites; no extra EF. Bounded flex slot so the
// grid's own overflow-y scroller, not the page, owns the list.
export default function HomeCatalogPage() {
  const { places, fetchError } = useHomeDeck();
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <CatalogGrid places={places} fetchError={fetchError} />
    </div>
  );
}
