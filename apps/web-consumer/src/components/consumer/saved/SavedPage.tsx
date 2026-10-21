"use client";

import { useState } from "react";
import { CalendarCheck, Heart } from "lucide-react";

import { ReservationsList } from "@/components/consumer/reservations-list";
import { CatalogTile } from "@/components/consumer/home/CatalogTile";
import { savedPlaceList } from "@/components/consumer/home/CatalogRails";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import type { Place } from "@/lib/api/places";
import { CONSUMER_ROUTES, SAVED_TAB_HREF } from "@/lib/consumer-route-contract";
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
import { cn } from "@/lib/utils";

// SAVED — the bar's fourth tab, /saved (Pato, MESITA-2521: "rename the
// bookings page to saved and then saved is divided into two things
// favorites, reservations. In favorites its just a feed of the liked palces
// while reservations is well, obiusly").
//
//   Saved                                  one white header, no back button:
//   ─────────────────────────────────────  it is a tab, not a Me page
//        Favorites      │   Reservations   Home's tab band, same classes
//   ━━━━━━━━━━━━━━━━━━━
//   the liked places, newest first         Home's tiles; the heart unlikes
//   — or —
//   upcoming, then past                    ReservationsList
//
// It was the Bookings tab (/bookings, MESITA-2518), which forwards to
// /saved?tab=reservations. Favorites are the guest's hearts — stored as
// `saved` (lib/saved-places.ts), the word on screen is Favorites; the keys
// never changed. NOTHING HERE FETCHES: the hearts are local (synced by the
// shell), and the list authenticates inside consumer-web-list-reservations.
//
// THE PANE IS A FLEX COLUMN, NOT A BLOCK: grow, min-h-0, scroll inside —
// a block parent collapses EmptyState.

export const SAVED_TABS = [
  { key: "favorites", label: "Favorites" },
  { key: "reservations", label: "Reservations" },
] as const;

export type SavedTab = (typeof SAVED_TABS)[number]["key"];

/** The tab an address asks for: `?tab=reservations`, else Favorites. */
export function savedTabFrom(param: string | string[] | undefined): SavedTab {
  return param === "reservations" ? "reservations" : "favorites";
}

const LIST = "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5 pb-6";

function Favorites() {
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

export function SavedPage({ initialTab }: { initialTab: SavedTab }) {
  const [tab, setTab] = useState<SavedTab>(initialTab);
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" data-saved>
      <header className="border-border bg-card/95 sticky top-0 z-20 flex h-[52px] shrink-0 items-center border-b px-4 backdrop-blur">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Saved
        </h1>
      </header>
      <div
        role="tablist"
        aria-label="Saved"
        className="border-border bg-card flex shrink-0 border-b"
        data-saved-tabs
      >
        {SAVED_TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setTab(t.key);
                // The address follows the tab, so a reload or a share lands
                // on it; no navigation, no refetch.
                window.history.replaceState(null, "", SAVED_TAB_HREF[t.key]);
              }}
              className={cn(
                "relative flex-1 py-3 text-sm transition",
                on ? "text-foreground font-semibold" : "text-muted-foreground",
              )}
            >
              {t.label}
              {on ? (
                <span
                  aria-hidden
                  className="bg-foreground absolute inset-x-0 bottom-0 h-0.5"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="bg-card scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        {tab === "favorites" ? (
          <Favorites />
        ) : (
          // ONE feed, no Upcoming/History control (Pato, 2026-08-17): the
          // list orders it — what's next, then what happened.
          <ReservationsList
            empty={
              <EmptyState
                icon={CalendarCheck}
                title="No reservations yet"
                description="Open any place and tap Reserve — Mesita calls to book it."
                action={{ label: "Find a place", href: CONSUMER_ROUTES.home }}
              />
            }
          />
        )}
      </div>
    </div>
  );
}
