"use client";

import { useMemo, useState } from "react";
import { Bookmark } from "lucide-react";
import { VenueCatalogCard } from "@/components/consumer/VenueCatalogCard";
import { ClassUpsellBox } from "@/app/(shell)/coupons/ClassUpsellBox";
import { ReservationsBody } from "@/app/(shell)/reservations/page";
import { SAVED_VENUES } from "@/lib/mock/saved-venues-mock";
import { mockVenue } from "@/lib/mock/venue";
import { enrichVenueOverview } from "@/lib/mock/enrich-overview";
import { useSavedVenues } from "@/lib/saved-venues";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";

type Tab = "places" | "reservations";

const TABS: { id: Tab; label: string; soon?: boolean }[] = [
  { id: "places", label: "Places" },
  // Reservations is parked behind a "Soon" badge — the tab opens a
  // coming-soon panel (no tickets) until the booking flow ships.
  { id: "reservations", label: "Reservations", soon: true },
];

// /saved is now a top-level BottomNav surface again — the "byebye
// coupons-as-entity" checkpoint promotes saving a place to a
// first-class action (it used to live as a Discover sub-tab at
// /discover/saved). Saving a venue is now place-only: no coupon is
// minted as a side effect.
//
// Content is identical to the prior Discover sub-route — a grid of
// VenueCatalogCards with an inline Unsave button. The shell layout's
// TopBar renders the "Saved" title above this page.

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
    // Overview parity — same fields the swipe card relies on so the
    // catalog/saved tile can surface rating, distance, zone, opening
    // status, and the promo chip. Sourced from the VenueDetail mock
    // fixture; will collapse to optional EF-returned fields once the
    // recommend/list EFs widen their response.
    google_rating: mockVenue.google.rating,
    google_count: mockVenue.google.count,
    price_range: mockVenue.price_range,
    last_updated_label: mockVenue.last_updated_label,
    open_now: mockVenue.open_now,
    opens_at: mockVenue.opens_at,
    distance_km: mockVenue.distance_km,
    zone: mockVenue.zone,
    reward_cap_mxn: mockVenue.reward_cap_mxn,
    is_first_visit: mockVenue.promo_matrix.is_first_visit,
  };
  cat.set(mvAsVenue.id, mvAsVenue);
  return cat;
}

export default function SavedPage() {
  const [tab, setTab] = useState<Tab>("places");
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        <div className="border-border bg-card grid grid-cols-2 gap-0 rounded-full border p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-full px-1 py-1.5 text-center text-[12px] font-medium transition",
                tab === t.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.soon && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0 text-[9px] font-bold tracking-wide uppercase",
                    tab === t.id
                      ? "bg-background/20 text-background"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  Soon
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "places" ? <PlacesBody /> : <ReservationsBody />}
      </div>
    </div>
  );
}

function PlacesBody() {
  const { savedIds, setSaved } = useSavedVenues();
  const catalog = useMemo(() => buildVenueCatalog(), []);
  const venues = useMemo<Venue[]>(() => {
    const ids = [...savedIds];
    if (ids.length === 0)
      return SAVED_VENUES.map((v) => enrichVenueOverview(v as Venue));
    return ids
      .map((id) => catalog.get(id))
      .filter((v): v is Venue => v != null)
      .map((v) => enrichVenueOverview(v));
  }, [savedIds, catalog]);

  function unsaveVenue(id: string) {
    const v = catalog.get(id);
    setSaved(id, false);
    if (v) toast(`Removed ${v.name} from saved`);
  }

  return (
    <div className="scrollbar-hide h-full overflow-y-auto">
      <div className="flex flex-col gap-4 px-4 py-4">
        {/* "Higher class, higher cashback" promo lives on /profile >
            Coupons, /coupons standalone, and here at the top of
            /saved — anywhere the consumer is browsing places worth
            spending on. Scrolls with the rest of the page; no
            sticky behavior. */}
        <ClassUpsellBox />

        {venues.length === 0 ? (
          <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
            Nothing saved yet. Swipe right on the Explore deck to bookmark a
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
