"use client";

// Home's header (Pato, MESITA-2447: "use the same searchbar here … Location,
// Searchbar, Ask AI"):
//
//   ( ⌖ ) [ ⚲ Search places…  ] ( ✦ )
//
// Search's bar row, token for token (header-classes.ts): the location disc
// (LocationPicker, opening the location sheet), the one SearchBar, the Ask AI
// disc. No chip row: Home's column already lists Nearby, Popular and every
// family. Focusing the bar opens Search with its bar focused — one search
// surface, not a second suggestion engine. Social and Favorites are rows of
// the catalog's column (CatalogRails). White like the bottom bar, its
// hairline under it (MESITA-2409). Home draws it from
// app/(shell)/(discovery)/discover/layout.tsx; Search has its own header
// (SearchHeader), so Home's never paints over the map (MESITA-1616).

import { useRouter } from "next/navigation";
import { LocationPicker } from "@/components/consumer/home/LocationPicker";
import { AskAiDisc } from "@/components/consumer/search/AskAiDisc";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

/** Home's header: location · bar · Ask AI, Search's row (MESITA-2447). */
export function ModeTabs() {
  const router = useRouter();
  return (
    <div className="border-border bg-card/95 sticky top-0 z-20 shrink-0 border-b backdrop-blur">
      <div
        className="flex min-w-0 items-center gap-2 px-3 pt-2 pb-2"
        data-home-header
      >
        <LocationPicker />
        <div className="min-w-0 flex-1">
          <SearchBar
            query=""
            showClear={false}
            onQueryChange={() => {}}
            onClear={() => {}}
            onFocus={() => router.push(`${CONSUMER_ROUTES.search}?focus=1`)}
          />
        </div>
        <AskAiDisc />
      </div>
    </div>
  );
}
