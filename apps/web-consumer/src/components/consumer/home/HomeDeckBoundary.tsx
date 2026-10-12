import type { ReactNode } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiRecommendDeck,
  apiFetchPublicPlaces,
  type Place,
} from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import { errMsg } from "@/lib/utils";
import { HomeDeckProvider } from "./HomeDeckContext";

// Async server component that fetches the Home deck ONCE and hands it to
// every /home sub-route via context. It lives inside the /home layout's
// Suspense boundary, so the pill nav paints immediately while this resolves,
// and — because it's part of the layout subtree — it is NOT re-run when
// navigating between sibling tabs (only the leaf page segment changes).
//
// Fetch mirrors the swipe deck: the deck EF (ranked, banded) first, public
// catalog as the fallback, overview enrichment applied so cards carry
// rating / zone / open-state.
//
// THE EF'S ORDER IS THE ORDER (MESITA-2047). Nothing here re-sorts the deck:
// the EF already bands it — open and near first, then open within reach,
// closed within reach, other cities last — and a client re-sort would lift
// a CLOSED place above every open card. The fallback, which nothing ranked,
// stays in catalog order.
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
      places = await apiFetchPublicPlaces(supabase);
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
