import { useQuery } from '@tanstack/react-query';

import {
  apiFetchPublicPlaces,
  apiRecommendDeck,
  type Place,
} from '@/lib/api/places';
import { supabase } from '@/lib/supabase';

async function fetchHomeDeck(): Promise<Place[]> {
  try {
    const result = await apiRecommendDeck(supabase, { limit: 50 });
    return result.deck;
  } catch {
    return apiFetchPublicPlaces(supabase);
  }
}

/** Shared Home deck query — Favorites + Social resolve place chips against it. */
export function useHomeDeck() {
  return useQuery({
    queryKey: ['home-deck'],
    queryFn: fetchHomeDeck,
  });
}
