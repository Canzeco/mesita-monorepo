"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  RailCard,
  RailCardSkeleton,
} from "@/components/consumer/search/SearchRailCard";
import { savedPlaceList } from "@/components/consumer/home/CatalogRails";
import { EmptyState } from "@/components/shared";
import type { Place } from "@/lib/api/places";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { withUserDistance } from "@/lib/place-distance";
import { isGoogleOnlyPlace } from "@/lib/place-placeholder";
import { placeHref } from "@/lib/place-route";
import { readSavedPlacePreviews, useSavedPlaces } from "@/lib/saved-places";
import { useCardSaveShare } from "@/lib/use-card-save-share";
import { useOpenGooglePlace } from "@/lib/use-open-google-place";
import { useUserLocation } from "@/lib/use-user-location";

// FAVORITES — Me › Favorites, /me/favorites (Pato, MESITA-2565: "saved show
// reservations directly. same for favorites. the page and route containing
// both reservations and saved its gone"). The hearted places, newest first,
// in Search's horizontal card (Pato, MESITA-2698: "in favorites use this
// style … the horizontal style"; Home's square tiles before), one per row,
// a tap opens the place; Saved unsaves, with Undo. It was the first tab of
// Saved (MESITA-2521), at /me/saved (MESITA-2561) and before that the bar's
// /saved.
//
// Favorites are the guest's hearts — stored as `saved` (lib/saved-places.ts);
// the word on screen is Favorites and the keys never changed. NOTHING HERE
// FETCHES: the hearts are local, synced by the shell.
//
// THE PANE IS A FLEX COLUMN, NOT A BLOCK: grow, min-h-0, scroll inside — a
// block parent collapses EmptyState.

const PANE =
  "scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain";
const LIST = "flex flex-col gap-2 px-5 pt-5 pb-6";

/** Three of Search's own loading cards (RailCardSkeleton, the RailCard
 *  frame, photo, rows and Save · Share) on the list's step: what this list
 *  draws until the hearts hydrate, and /me/favorites/loading.tsx draws whole
 *  (Pato, MESITA-2701: "the placeholders must be similar to the page you are
 *  loading, like the sizes"; one flat grey bar of the card's height before). */
function FavoritesListSkeleton() {
  return (
    <div className={LIST} aria-hidden>
      {[0, 1, 2].map((i) => (
        <RailCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** The Favorites pane while the route loads: the pane and the list. */
export function FavoritesSkeleton() {
  return (
    <div className={PANE}>
      <FavoritesListSkeleton />
    </div>
  );
}

function FavoritesList() {
  const { savedIds, hydrated } = useSavedPlaces();
  const cards = useCardSaveShare();
  const router = useRouter();
  const coords = useUserLocation();
  const openGooglePlace = useOpenGooglePlace();
  if (!hydrated) return <FavoritesListSkeleton />;
  const list = savedPlaceList(savedIds, readSavedPlacePreviews<Place>());
  if (list.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="No favorites yet"
        description="Tap the heart on a place and it lands here."
        action={{ label: "Find a place", href: CONSUMER_ROUTES.home }}
      />
    );
  }
  const open = (place: Place) => {
    if (isGoogleOnlyPlace(place)) openGooglePlace(place);
    else router.push(placeHref(place.slug || place.id));
  };
  return (
    <ul role="list" aria-label="Favorites" className={LIST}>
      {list.map((place) => (
        <li key={place.id}>
          <RailCard
            place={withUserDistance(place, coords)}
            selected={false}
            onOpen={() => open(place)}
            saved={cards.isSaved(place)}
            onSave={() => cards.toggle(place)}
            onShare={() => cards.share(place)}
            withDistance
          />
        </li>
      ))}
    </ul>
  );
}

export function FavoritesPage() {
  return (
    <div className={PANE}>
      <FavoritesList />
    </div>
  );
}
