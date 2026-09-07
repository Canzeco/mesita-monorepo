"use client";

import { PlaceFeed } from "@/components/consumer/home/PlaceFeed";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Feed — new mode, second pill (Pato, MESITA-1621). Reads the SHARED deck
// rather than fetching its own, exactly like Swipe, Chat and Favs: the layout
// stays mounted across mode switches, so flipping between Feed and Swipe
// costs no recommender call and both modes show the same places in the same
// order. Catalog is the one mode that fetches for itself (its rails are a
// different query), which is why it takes no props.
export default function DiscoverFeedPage() {
  const { places, fetchError } = useHomeDeck();
  return <PlaceFeed places={places} fetchError={fetchError} />;
}
