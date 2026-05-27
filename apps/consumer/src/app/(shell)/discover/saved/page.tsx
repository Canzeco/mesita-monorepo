"use client";

import { useMemo } from "react";
import { Bookmark } from "lucide-react";
import { VenueCatalogCard } from "@/components/consumer/VenueCatalogCard";
import { SAVED_VENUES } from "@/lib/consumer-data";
import { mockVenue } from "@/lib/mock/venue";
import { useSavedVenues } from "@/lib/saved-venues";
import { toast } from "@/lib/toast";
import type { Venue } from "@/lib/api/venues";

// Saved is now a Discover sub-route (lives alongside Swipe / Catalog /
// Map / AI under the DiscoverTabs strip) rather than a top-level
// BottomNav tab. Bookmarking a venue is part of how you find places, not
// a wallet concern, so it groups with discovery surfaces.
//
// Content is identical to the old /saved page's "venues" tab — venues
// section only. Reservations moved to /reservations and coupons to
// /coupons when the entity-split landed.

export const dynamic = "force-dynamic";

function buildVenueCatalog(): Map<string, Venue> {
  const cat = new Map<string, Venue>();
  for (const v of SAVED_VENUES) cat.set(v.id, v as Venue);
  const mvAsVenue: Venue = {
    id: mockVenue.id,
    slug: mockVenue.id,
    name: mockVenue.name,
    category: mockVenue.category,
    vibe: mockVenue.vibe,
    price_level: mockVenue.price_level,
    currency: mockVenue.currency,
    listing_type: mockVenue.listing_type,
    status: "active",
    fiscal_type: "formal",
    plan: "formal_pro",
    lat: null,
    lng: null,
    address: mockVenue.address,
    closes_at: mockVenue.closes_at,
    phone: null,
    pitch: null,
    story: null,
    cashback_percent: 20,
    photos: mockVenue.photos.slice(0, 1),
    website_url: null,
    instagram_url: null,
    tiktok_url: null,
    facebook_url: null,
    whatsapp_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    rappi_url: null,
    x_url: null,
    youtube_url: null,
    threads_url: null,
    reddit_url: null,
    didi_food_url: null,
    tripadvisor_url: null,
    google_maps_url: null,
    email: null,
    created_at: new Date(0).toISOString(),
  };
  cat.set(mvAsVenue.id, mvAsVenue);
  return cat;
}

export default function DiscoverSavedPage() {
  const { savedIds, setSaved } = useSavedVenues();
  const catalog = useMemo(() => buildVenueCatalog(), []);
  const venues = useMemo<Venue[]>(() => {
    const ids = [...savedIds];
    if (ids.length === 0) return SAVED_VENUES as Venue[];
    return ids
      .map((id) => catalog.get(id))
      .filter((v): v is Venue => v != null);
  }, [savedIds, catalog]);

  function unsaveVenue(id: string) {
    const v = catalog.get(id);
    setSaved(id, false);
    if (v) toast(`Removed ${v.name} from saved`);
  }

  return (
    <div className="px-4 py-4">
      {venues.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
          Nothing saved yet. Swipe right on the Discover deck to bookmark a
          venue.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {venues.map((v) => (
            <SavedVenueTile
              key={v.id}
              venue={v}
              onUnsave={() => unsaveVenue(v.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedVenueTile({
  venue,
  onUnsave,
}: {
  venue: Venue;
  onUnsave: () => void;
}) {
  return (
    <div className="relative">
      <VenueCatalogCard venue={venue} />
      <button
        type="button"
        aria-label="Remove from saved"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onUnsave();
        }}
        className="bg-background/95 text-foreground hover:bg-background absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-sm backdrop-blur transition"
      >
        <Bookmark className="h-3.5 w-3.5 fill-current" />
      </button>
    </div>
  );
}
