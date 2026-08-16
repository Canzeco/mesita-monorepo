import { useQuery } from '@tanstack/react-query';

import {
  apiFetchPublicPlaces,
  apiRecommendDeck,
  type Place,
} from '@/lib/api/places';
import { supabase } from '@/lib/supabase';

// consumer-web-recommend-swipe returns a random sample of active places —
// there is no ranking engine behind it. The public catalog is the fallback
// when the deck EF fails.
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
