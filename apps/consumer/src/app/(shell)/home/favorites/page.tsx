"use client";

import { FavoritesList } from "@/components/consumer/home/FavoritesList";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Favorites — saved places (localStorage ids) resolved against the shared deck.
export default function HomeFavoritesPage() {
  const { places } = useHomeDeck();
  return <FavoritesList deckPlaces={places} />;
}
