"use client";

// Search's header (Pato, MESITA-2401: "Search, Chat, Filters"): the same
// two-half row as Home's — Search · Chat pills on the left, the Filters disc
// at the right edge, always in the same spot. On Chat (Soon) no filter
// applies yet, so the disc is drawn muted and disabled rather than moving.

import { TabHeader, SEARCH_MODES } from "@/components/consumer/ModeTabs";
import { SearchFilterRow } from "./SearchFilterRow";

export function SearchHeader({
  filterCount = 0,
  onOpenFilters,
}: {
  filterCount?: number;
  /** Absent on Chat: the disc stays, disabled. */
  onOpenFilters?: () => void;
}) {
  return (
    <TabHeader
      modes={SEARCH_MODES}
      label="Search"
      aside={
        <SearchFilterRow
          variant="header"
          count={filterCount}
          onOpenFilters={onOpenFilters}
        />
      }
    />
  );
}
