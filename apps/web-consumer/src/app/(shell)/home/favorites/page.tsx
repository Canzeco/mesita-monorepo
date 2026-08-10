"use client";

import { FavoritesList } from "@/components/consumer/home/FavoritesList";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Favorites — saved places (localStorage ids) resolved against the shared deck.
//
// `fetchError` rides along: when the deck fetch fails the saves still render
// from their stored previews, but the list has to SAY the picks are stale
// rather than quietly showing a thinner screen.
export default function HomeFavoritesPage() {
  const { places, fetchError } = useHomeDeck();
  return <FavoritesList deckPlaces={places} deckError={fetchError} />;
}
