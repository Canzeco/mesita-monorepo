"use client";

// The Places tab (Pato's sketch, MESITA-2402 — a test):
//
//   ( ⌖ ) [ ⚲ Search places…          ] ( ✦ )   Location · search · AI
//   ┌──────────┬──────────────────────────┐
//   │ ❤️ Favs   │  [ Catalog ][   Map   ]  │
//   │▌✨ Feat.  │                          │
//   │ ☕ Coffee │   tiles, or the same     │
//   │ …        │   list as pins           │
//
// The column, the pool and the tiles are Home's (CatalogRails); the map is
// Search's (SearchMap). The bar filters both by name, client-side. AI goes
// to Search › Chat, which is Soon.

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { CatalogRails } from "@/components/consumer/home/CatalogRails";
import { LocationPicker } from "@/components/consumer/home/LocationPicker";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export function PlacesClient({ apiKey }: { apiKey: string }) {
  const [query, setQuery] = useState("");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="border-foreground/20 bg-background/90 sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b-2 px-2 py-2 backdrop-blur-xl"
        data-places-header
      >
        <LocationPicker compact />
        <div className="min-w-0 flex-1">
          <SearchBar
            query={query}
            showClear={query.length > 0}
            onQueryChange={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search places by name…"
          />
        </div>
        <Link
          href={CONSUMER_ROUTES.searchChat}
          aria-label="Ask AI"
          className="border-border bg-card/95 shadow-elev text-foreground hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-[0.98]"
          data-places-ai
        >
          <Sparkles className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </Link>
      </div>
      <CatalogRails query={query} mapApiKey={apiKey} />
    </div>
  );
}
