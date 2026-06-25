"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import type { MyVenue } from "@/lib/api/venues";
import { cn } from "@/lib/utils";
import {
  formatVenueCategoryName,
  resolveVenueCategoryName,
} from "@/lib/venue-category";
import { PlaceModule } from "../PlaceModule";
import { PlaceProfileProgressModule } from "./PlaceProfileProgressModule";
import { PlaceRefreshModule } from "./PlaceRefreshModule";
import type { PlaceFormState } from "../place-form-types";
import { MAX_PHOTOS } from "../place-upload-utils";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function shortLocationFromAddress(address: string): string {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] ?? "Neighborhood";
}

function resolvePreviewRewardRate(venue: MyVenue): number | null {
  const rates = [
    venue.welcome_free_rate,
    venue.welcome_premium_rate,
    venue.free_rate,
    venue.premium_rate,
  ].filter((rate): rate is number => typeof rate === "number" && rate > 0);
  if (rates.length === 0) return null;
  return Math.max(...rates);
}

function previewMeta(venue: MyVenue, v: PlaceFormState) {
  const name = v.name || venue.name || "Venue name";
  const category =
    (v.category && formatVenueCategoryName(v.category)) ||
    resolveVenueCategoryName({
      categoryLabel: venue.category_label,
      category: venue.category,
    }) ||
    null;
  const price =
    venue.price_level != null ? "$".repeat(venue.price_level) : null;
  const googleRating =
    venue.google_stars_overall != null
      ? venue.google_stars_overall.toFixed(1)
      : null;
  const googleCount =
    venue.google_review_count != null
      ? formatCount(venue.google_review_count)
      : null;
  const instagramFollowers =
    venue.instagram_followers_count != null
      ? formatCount(venue.instagram_followers_count)
      : null;
  const zone = venue.address
    ? shortLocationFromAddress(venue.address)
    : "Neighborhood";
  const distance = null;
  const status = venue.closes_at ? `Open · until ${venue.closes_at}` : null;
  const isPartner = true;
  const rewardRate = resolvePreviewRewardRate(venue);
  const rewardMechanic =
    venue.fiscal_type === "informal" ? "Discount" : "Reward";
  const promoLabel =
    rewardRate != null
      ? `Reward · ${rewardRate}% ${rewardMechanic}`
      : "No reward yet";

  return {
    name,
    category,
    price,
    googleRating,
    googleCount,
    instagramFollowers,
    zone,
    distance,
    status,
    isPartner,
    promoLabel,
  };
}

function PreviewMetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-medium backdrop-blur-sm">
      {children}
    </span>
  );
}

function PreviewSwipeCard({
  venue,
  v,
}: {
  venue: MyVenue;
  v: PlaceFormState;
}) {
  const photos = v.photos.slice(0, MAX_PHOTOS);
  const [photoIdx, setPhotoIdx] = useState(0);
  const safeIdx = photoIdx > photos.length - 1 ? 0 : photoIdx;
  const cover = photos[safeIdx] ?? null;
  const meta = previewMeta(venue, v);
  const canSlide = photos.length > 1;

  return (
    <div className="relative z-0 mx-auto w-full max-w-[200px] overflow-hidden rounded-xl border bg-card">
      <div className="bg-muted relative aspect-[4/5] w-full overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={meta.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-white/70">
            <span className="font-display text-5xl font-bold tracking-tight">
              {meta.name.trim().slice(0, 1).toUpperCase() || "·"}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pt-8 pb-3 text-white">
          <h2 className="font-display text-base leading-tight font-semibold tracking-tight">
            {meta.name}
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {meta.category ? (
              <PreviewMetaChip>{meta.category}</PreviewMetaChip>
            ) : null}
            {meta.googleRating ? (
              <PreviewMetaChip>
                {meta.googleRating}
                <Star
                  className="h-2.5 w-2.5 fill-amber-400 text-amber-400"
                  strokeWidth={0}
                />
              </PreviewMetaChip>
            ) : null}
          </div>
        </div>

        {canSlide ? (
          <div className="absolute inset-x-0 bottom-14 z-20 flex justify-center gap-1">
            {photos.map((_, idx) => (
              <button
                key={`preview-dot-${idx}`}
                type="button"
                onClick={() => setPhotoIdx(idx)}
                aria-label={`Photo ${idx + 1}`}
                className={cn(
                  "h-1 rounded-full transition-all",
                  idx === safeIdx ? "w-3 bg-white" : "w-1 bg-white/50",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PlacePreviewModule({
  venue,
  v,
  refreshRunning,
  refreshNotice,
  onRefresh,
}: {
  venue: MyVenue;
  v: PlaceFormState;
  refreshRunning: boolean;
  refreshNotice: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PlaceModule id="preview" contentClassName="items-center">
        <PreviewSwipeCard venue={venue} v={v} />
      </PlaceModule>
      <PlaceProfileProgressModule v={v} />
      <PlaceRefreshModule
        running={refreshRunning}
        notice={refreshNotice}
        onRefresh={onRefresh}
      />
    </div>
  );
}
