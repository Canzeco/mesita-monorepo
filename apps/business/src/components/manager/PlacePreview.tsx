"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, Eye, Layers, Sparkles, Smartphone } from "lucide-react";
import { VenueSwipeCardFace } from "@/components/guest/VenueSwipeCardFace";
import { VenueCatalogCard } from "@/components/guest/VenueCatalogCard";
import { PartnerBadge, RatePill } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";

// Live preview of how the venue surfaces inside the guest app.
//
// Cross-route imports note: the guest UI components live under
// src/components/guest/* — Next.js app router doesn't enforce any "guest
// app" vs "manager app" boundary, so importing from there into a manager
// surface is idiomatic. We extracted VenueSwipeCardFace and
// VenueCatalogCard from their original colocated spots specifically so
// both routes share the same source of truth instead of duplicating
// chrome.

type Tab = "swipe" | "catalog" | "detail";

const TABS: { id: Tab; label: string; Icon: typeof Eye }[] = [
  { id: "swipe", label: "Swipe", Icon: Smartphone },
  { id: "catalog", label: "Catalog", Icon: Layers },
  { id: "detail", label: "Detail page", Icon: Eye },
];

export function PlacePreview({ venue }: { venue: Venue }) {
  const [tab, setTab] = useState<Tab>("swipe");

  return (
    <section className="border-border bg-card rounded-2xl border p-5">
      <header className="mb-4 flex flex-col items-start gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Live guest preview
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            What guests see across the swipe deck, catalog rows, and venue page.
            Updates as you edit — saving persists; the preview itself is just a
            window.
          </p>
        </div>
      </header>

      <div className="-mx-1 mb-4 flex flex-wrap gap-2">
        {TABS.map(({ id, label, Icon }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                on
                  ? "bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground border",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        {tab === "swipe" && <SwipePreview venue={venue} />}
        {tab === "catalog" && <CatalogPreview venue={venue} />}
        {tab === "detail" && <DetailPreview venue={venue} />}
      </div>
    </section>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  // A minimal phone-shaped frame for embedding guest surfaces inside the
  // manager dashboard. Smaller than the real MobileFrame so it fits as a
  // preview panel rather than dominating the page.
  return (
    <div className="w-full max-w-sm">
      <div className="border-foreground/10 bg-background shadow-elev overflow-hidden rounded-3xl border-[6px]">
        {children}
      </div>
    </div>
  );
}

function SwipePreview({ venue }: { venue: Venue }) {
  return (
    <PhoneFrame>
      <div className="bg-background p-3">
        <div className="relative aspect-[3/5] w-full">
          <VenueSwipeCardFace
            venue={venue}
            carousel
            className="absolute inset-0"
          />
        </div>
      </div>
    </PhoneFrame>
  );
}

function CatalogPreview({ venue }: { venue: Venue }) {
  return (
    <PhoneFrame>
      <div className="bg-background p-4">
        <p className="font-display text-lg font-semibold tracking-tight">
          Best cashback
        </p>
        <p className="text-muted-foreground text-[11px]">
          Most back on the bill
        </p>
        <div className="scrollbar-hide mt-3 flex gap-3 overflow-x-auto pb-1">
          <div className="w-56 flex-shrink-0">
            <VenueCatalogCard venue={venue} href={null} />
          </div>
          <div className="w-56 flex-shrink-0 opacity-40">
            <VenueCatalogCard venue={venue} href={null} />
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function DetailPreview({ venue }: { venue: Venue }) {
  // Mimics the top of /guest/venue/[id] — hero photo + title block + the
  // cashback hero strip when the venue is a partner with a rate. Kept as
  // an inert snippet; full detail page features (story, channels, map
  // link) aren't reproduced — for those, the preview is "good enough".
  const photo = venue.photos[0];
  const meta = [
    venue.price_level != null ? "$".repeat(venue.price_level) : null,
    venue.closes_at ? `until ${venue.closes_at}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const subtitle = [venue.vibe, venue.category]
    .filter(Boolean)
    .join(" · ")
    .toLowerCase();

  return (
    <PhoneFrame>
      <div className="bg-background">
        <div className="relative">
          <div className="absolute top-3 left-3 z-20">
            <span className="text-foreground flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur">
              <ArrowLeft className="h-4 w-4" />
            </span>
          </div>
          <div className="bg-muted relative aspect-[4/5] w-full">
            {photo ? (
              <Image
                src={photo}
                alt={venue.name}
                fill
                sizes="(max-width: 768px) 100vw, 384px"
                className="object-cover"
              />
            ) : (
              <div className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-white/70">
                <span className="font-display text-6xl font-bold tracking-tight">
                  {venue.name[0]?.toUpperCase() ?? "·"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          <header className="flex flex-col gap-1">
            {subtitle && (
              <p className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">
                {subtitle}
              </p>
            )}
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {venue.name}
            </h1>
            {meta && <p className="text-muted-foreground text-xs">{meta}</p>}
          </header>

          <div className="flex flex-wrap items-center gap-1.5">
            <PartnerBadge listingType={venue.listing_type} size="sm" />
            {venue.listing_type === "partner" &&
              venue.cashback_percent != null &&
              venue.cashback_percent > 0 && (
                <RatePill
                  percent={venue.cashback_percent}
                  mechanic={
                    venue.fiscal_type === "informal" ? "discount" : "cashback"
                  }
                  size="sm"
                />
              )}
          </div>

          {venue.listing_type === "partner" &&
            venue.cashback_percent != null &&
            venue.cashback_percent > 0 && (
              <div className="bg-pink-gradient shadow-glow flex items-center justify-between rounded-2xl p-3 text-white">
                <div>
                  <p className="text-[9px] font-bold tracking-wider text-white/80 uppercase">
                    Verified partner
                  </p>
                  <p className="font-display mt-0.5 text-base font-semibold">
                    {venue.cashback_percent}%{" "}
                    {venue.fiscal_type === "informal" ? "discount" : "cashback"}{" "}
                    on every visit
                  </p>
                </div>
                <Sparkles className="h-5 w-5 text-white/80" />
              </div>
            )}

          {venue.pitch && (
            <p className="text-foreground text-sm leading-relaxed">
              {venue.pitch}
            </p>
          )}
          {venue.story && (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {venue.story}
            </p>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
