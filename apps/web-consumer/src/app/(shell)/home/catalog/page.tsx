"use client";

import { CatalogRails } from "@/components/consumer/home/CatalogRails";

// Catalog — stacked search rails (Atlas seeds + vibe queries). Own EF;
// not the swipe deck.
export default function HomeCatalogPage() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <CatalogRails />
    </div>
  );
}
