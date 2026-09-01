"use client";

import { FavoritesList } from "@/components/consumer/home/FavoritesList";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Favs — un-parked 2026-09-01. Saved place ids live in localStorage and are
// resolved against the shared deck.
//
// `fetchError` rides along: when the deck fetch fails the saves still render
// from their stored previews, but the list has to SAY the picks are stale
// rather than quietly showing a thinner screen.
export default function DiscoverFavsPage() {
  const { places, fetchError } = useHomeDeck();
  return <FavoritesList deckPlaces={places} deckError={fetchError} />;
}
