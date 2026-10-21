"use client";

import { Heart } from "lucide-react";

import { CatalogTile } from "@/components/consumer/home/CatalogTile";
import { savedPlaceList } from "@/components/consumer/home/CatalogRails";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import type { Place } from "@/lib/api/places";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { withUserDistance } from "@/lib/place-distance";
import {
  readSavedPlacePreviews,
  removeSavedPlacePreview,
  upsertSavedPlacePreview,
  useSavedPlaces,
} from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import { useOpenGooglePlace } from "@/lib/use-open-google-place";
import { useUserLocation } from "@/lib/use-user-location";

// FAVORITES — Me › Favorites, /me/favorites (Pato, MESITA-2565: "saved show
// reservations directly. same for favorites. the page and route containing
// both reservations and saved its gone"). The hearted places, newest first,
// in Home's tiles; the heart unlikes, with Undo. It was the first tab of
// Saved (MESITA-2521), at /me/saved (MESITA-2561) and before that the bar's
// /saved.
//
// Favorites are the guest's hearts — stored as `saved` (lib/saved-places.ts);
// the word on screen is Favorites and the keys never changed. NOTHING HERE
// FETCHES: the hearts are local, synced by the shell.
//
// THE PANE IS A FLEX COLUMN, NOT A BLOCK: grow, min-h-0, scroll inside — a
// block parent collapses EmptyState.

const LIST = "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5 pb-6";

function FavoritesList() {
  const { savedIds, hydrated, setSaved } = useSavedPlaces();
  const coords = useUserLocation();
  const openGooglePlace = useOpenGooglePlace();
  if (!hydrated) {
    return (
      <div className={LIST}>
        <Skeleton className="aspect-square rounded-2xl" />
      </div>
    );
  }
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
  const unlike = (place: Place) => {
    setSaved(place.id, false);
    removeSavedPlacePreview(place.id);
    toast.action("Removed from favorites", {
      label: "Undo",
      onClick: () => {
        upsertSavedPlacePreview(place);
        setSaved(place.id, true);
      },
    });
  };
  return (
    <ul role="list" aria-label="Favorites" className={LIST}>
      {list.map((place) => (
        <CatalogTile
          key={place.id}
          place={withUserDistance(place, coords)}
          saved
          onToggle={() => unlike(place)}
          onOpenGoogle={() => openGooglePlace(place)}
        />
      ))}
    </ul>
  );
}

export function FavoritesPage() {
  return (
    <div className="bg-card scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
      <FavoritesList />
    </div>
  );
}
