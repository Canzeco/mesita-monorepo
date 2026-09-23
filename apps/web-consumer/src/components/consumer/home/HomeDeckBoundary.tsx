import type { ReactNode } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiRecommendDeck,
  apiFetchPublicPlaces,
  type Place,
} from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import { errMsg } from "@/lib/utils";
import { HomeDeckProvider } from "./HomeDeckContext";
import { isPromoting } from "@/lib/promo-rates";

// Async server component that fetches the Home deck ONCE and hands it to
// every /home sub-route via context. It lives inside the /home layout's
// Suspense boundary, so the pill nav paints immediately while this resolves,
// and — because it's part of the layout subtree — it is NOT re-run when
// navigating between sibling tabs (only the leaf page segment changes).
//
// Fetch mirrors the swipe deck: the deck EF (ranked, banded, bought slots
// already placed) first, public catalog as the fallback, overview enrichment
// applied so cards carry rating / zone / open-state.
//
// THE EF'S ORDER IS THE ORDER (MESITA-2047). This used to float every
// promoting place to the top here, which quietly overrode the bought lane's
// every-Nth slot — and once the deck started backfilling closed places behind
// the open ones, it would have lifted a promoting CLOSED place above every
// open card. Only the fallback, which nothing ranked, still floats promoting
// places first.
export async function HomeDeckBoundary({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();

  let places: Place[] = [];
  let fetchError: string | null = null;
  try {
    const result = await apiRecommendDeck(supabase, { limit: 50 });
    places = result.deck;
  } catch (err) {
    console.warn(
      "[home] consumer-web-recommend-swipe failed, falling back:",
      errMsg(err, "recommend failed"),
    );
    try {
      const unranked = await apiFetchPublicPlaces(supabase);
      places = [...unranked].sort(
        (a, b) => (isPromoting(a) ? 0 : 1) - (isPromoting(b) ? 0 : 1),
      );
    } catch (err2) {
      fetchError = errMsg(err2, "Failed to load places.");
    }
  }

  const listed = places.filter((p) => !p.googleOnly && !p.from_google);
  const enriched = listed.map((v) => enrichPlaceOverview(v));

  return (
    <HomeDeckProvider places={enriched} fetchError={fetchError}>
      {children}
    </HomeDeckProvider>
  );
}
