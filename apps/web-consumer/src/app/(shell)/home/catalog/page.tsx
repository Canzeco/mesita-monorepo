"use client";

import { CatalogRails } from "@/components/consumer/home/CatalogRails";

// Catalog — stacked search rails (Atlas seeds + vibe queries). Own EF;
// not the swipe deck.
//
// Flex column, not a clipped block: CatalogRails is `flex-1 overflow-y-auto`
// (vertical stack of rails, each rail `overflow-x-auto`). A block
// overflow-hidden here is the inbox bug — the scroller never gets a height
// and later rails clip under the tab bar.
export default function HomeCatalogPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CatalogRails />
    </div>
  );
}
