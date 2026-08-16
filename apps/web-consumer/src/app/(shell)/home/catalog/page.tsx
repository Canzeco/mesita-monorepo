"use client";

import { CatalogGrid } from "@/components/consumer/home/CatalogGrid";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Catalog — the shared deck as a browsable grid (un-parked 2026-08-16).
//
// `fetchError` rides along: with no deck there is nothing to browse at all, so
// unlike Favorites (which falls back to stored previews) this surface has to
// say the fetch failed rather than render an empty grid that looks like an
// empty catalog.
export default function HomeCatalogPage() {
  const { places, fetchError } = useHomeDeck();
  return <CatalogGrid places={places} fetchError={fetchError} />;
}
