"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bookmark,
  Clock,
  Navigation,
  ShieldAlert,
  Star,
} from "lucide-react";
import { PromoChip } from "@/components/consumer/PromoChip";
import { ClassUpsellBox } from "@/app/(shell)/coupons/ClassUpsellBox";
import { ReservationsBody } from "@/app/(shell)/reservations/page";
import { enrichVenueOverview } from "@/lib/mock/enrich-overview";
import {
  readSavedVenuePreviews,
  removeSavedVenuePreview,
  useSavedVenues,
} from "@/lib/saved-venues";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { apiFetchPublicVenues, type Venue } from "@/lib/api/venues";
import { resolveVenueCategoryName } from "@/lib/venue-category";
import { useBrowserSupabase } from "@/lib/supabase/browser";

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

export default function SavedPage() {
  const [tab, setTab] = useState<Tab>("places");
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        <div className="border-border bg-card grid grid-cols-2 gap-0 rounded-2xl border p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl px-1 py-1.5 text-center text-[12px] font-medium transition",
                tab === t.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.soon && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0 text-[9px] font-bold tracking-wide uppercase",
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
  const supabase = useBrowserSupabase();
  const { savedIds, setSaved } = useSavedVenues();
  const [previewCatalog] = useState<Map<string, Venue>>(() =>
    readSavedVenuePreviews<Venue>(),
  );
  const [liveCatalog, setLiveCatalog] = useState<Map<string, Venue> | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const venues = await apiFetchPublicVenues(supabase, 400);
        if (!active) return;
        const next = new Map<string, Venue>();
        for (const venue of venues) {
          next.set(venue.id, enrichVenueOverview(venue));
        }
        setLiveCatalog(next);
      } catch {
        if (!active) return;
        // Reset-safety: if we cannot read server venues, fall back to an
        // empty live catalog so stale local saved IDs/previews get purged.
        setLiveCatalog(new Map());
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  const catalog = useMemo(() => {
    const merged = new Map<string, Venue>();
    for (const [id, venue] of previewCatalog) merged.set(id, venue);
    if (liveCatalog) {
      for (const [id, venue] of liveCatalog) merged.set(id, venue);
    }
    return merged;
  }, [liveCatalog, previewCatalog]);
  const venues = useMemo<Venue[]>(() => {
    const ids = [...savedIds];
    if (ids.length === 0) return [];
    return ids
      .map((id) => catalog.get(id))
      .filter((v): v is Venue => v != null)
      .map((v) => enrichVenueOverview(v));
  }, [savedIds, catalog]);

  // If DB reset removed venues, purge stale local bookmarks so Saved truly
  // reflects server reality after reset.
  useEffect(() => {
    if (!liveCatalog) return;
    for (const id of savedIds) {
      if (!liveCatalog.has(id)) {
        setSaved(id, false);
        removeSavedVenuePreview(id);
      }
    }
  }, [liveCatalog, removeSavedVenuePreview, savedIds, setSaved]);

  function unsaveVenue(id: string) {
    const v = catalog.get(id);
    setSaved(id, false);
    removeSavedVenuePreview(id);
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
          <div className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
            Nothing saved yet. Swipe right on the Explore deck to bookmark a
            venue.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
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
  const photo = venue.photos[0];
  const category = resolveVenueCategoryName({
    categoryLabel: venue.category_label,
    category: venue.category,
  });
  const priceLevel = venue.price_level != null ? "$".repeat(venue.price_level) : null;
  const ratingLabel =
    venue.google_rating != null ? venue.google_rating.toFixed(1) : null;
  const ratingCountLabel =
    venue.google_count != null ? formatCompactCount(venue.google_count) : null;
  const distanceLabel = venue.distance_km != null ? `${venue.distance_km} km` : null;
  const isPartner = venue.listing_type === "partner";
  const isOpen = venue.open_now === true;
  const statusLabel = venue.opens_at
    ? `Open · until ${venue.opens_at}`
    : venue.closes_at
      ? `Open · until ${venue.closes_at}`
      : venue.open_now === false
        ? "Closed now"
        : null;

  return (
    <div className="relative">
      <Link
        href={`/place/${venue.slug || venue.id}`}
        className="border-border bg-card hover:shadow-md flex min-h-[118px] w-full overflow-hidden rounded-xl border transition"
      >
        <div className="bg-muted relative w-[42%] shrink-0">
          {photo ? (
            <Image
              src={photo}
              alt={venue.name}
              fill
              sizes="(max-width: 768px) 40vw, 240px"
              className="object-cover"
            />
          ) : (
            <div className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-white/80">
              <span className="font-display text-3xl font-bold tracking-tight">
                {venue.name[0]?.toUpperCase() ?? "·"}
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2.5 pr-10">
          <h3 className="font-display truncate text-[19px] leading-tight font-semibold tracking-tight">
            {venue.name}
          </h3>

          <div className="flex flex-wrap items-center gap-1.5">
            {category && (
              <SavedMetaTag>
                <span className="font-semibold">{category}</span>
              </SavedMetaTag>
            )}
            {priceLevel && (
              <SavedMetaTag>
                <span className="font-semibold">{priceLevel}</span>
              </SavedMetaTag>
            )}
            {ratingLabel && (
              <SavedMetaTag>
                <span className="font-semibold">{ratingLabel}</span>
                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                {ratingCountLabel && (
                  <span className="text-white/70">({ratingCountLabel})</span>
                )}
              </SavedMetaTag>
            )}
            {distanceLabel && (
              <SavedMetaTag>
                <Navigation className="h-3 w-3 shrink-0 text-white/70" />
                <span className="font-semibold">{distanceLabel}</span>
              </SavedMetaTag>
            )}
            {statusLabel && (
              <SavedMetaTag>
                <Clock
                  className={isOpen ? "h-3 w-3 shrink-0 text-emerald-400" : "h-3 w-3 shrink-0 text-white/70"}
                />
                <span className="font-semibold">{statusLabel}</span>
              </SavedMetaTag>
            )}
            <SavedMetaTag>
              {isPartner ? (
                <>
                  <BadgeCheck
                    className="h-3.5 w-3.5 shrink-0 fill-sky-500 text-white"
                    strokeWidth={2}
                  />
                  <span className="font-semibold">Verified</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                  <span className="font-semibold">Not Verified</span>
                </>
              )}
            </SavedMetaTag>
          </div>

          <div className="mt-auto flex items-center gap-2">
            <span className="text-muted-foreground text-[10.5px] font-semibold uppercase">
              Current reward
            </span>
            <PromoChip venue={venue} size="sm" showWhenEmpty />
          </div>
        </div>
      </Link>

      <button
        type="button"
        aria-label="Remove from saved"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onUnsave();
        }}
        className="bg-background/95 text-foreground hover:bg-background absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg shadow-sm backdrop-blur transition"
      >
        <Bookmark className="h-3.5 w-3.5 fill-current" />
      </button>
    </div>
  );
}

function SavedMetaTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-black/45 px-2.5 py-1 text-[11px] whitespace-nowrap text-white backdrop-blur-md">
      {children}
    </span>
  );
}

function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}
