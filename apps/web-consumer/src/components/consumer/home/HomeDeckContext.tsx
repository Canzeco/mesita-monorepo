"use client";

// Shared Home deck context. The /discover layout fetches the recommendation
// deck ONCE (HomeDeckBoundary) and provides it here; Scroll, Chat and Favs
// read it via useHomeDeck() so switching pills is client navigation between
// siblings under the persistent layout — no recommender re-fetch per pill.

import { createContext, useContext, type ReactNode } from "react";
import type { Place } from "@/lib/api/places";

type HomeDeck = { places: Place[]; fetchError: string | null };

const HomeDeckContext = createContext<HomeDeck | null>(null);

export function HomeDeckProvider({
  places,
  fetchError,
  children,
}: HomeDeck & { children: ReactNode }) {
  return (
    <HomeDeckContext.Provider value={{ places, fetchError }}>
      {children}
    </HomeDeckContext.Provider>
  );
}

export function useHomeDeck(): HomeDeck {
  const ctx = useContext(HomeDeckContext);
  if (!ctx) {
    throw new Error("useHomeDeck must be used within a HomeDeckProvider");
  }
  return ctx;
}
