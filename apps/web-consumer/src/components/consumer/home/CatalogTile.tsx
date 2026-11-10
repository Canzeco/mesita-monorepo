"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PlaceMarks, SizedImage } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { placeHref } from "@/lib/place-route";
import { sharePlace } from "@/lib/share-place";
import {
  cardPhoto,
  isGoogleOnlyPlace,
  placePlaceholder,
} from "@/lib/place-placeholder";
import { cn } from "@/lib/utils";
import {
  CardActions,
  HoursRow,
  KindRow,
  cardFacts,
} from "@/components/consumer/place-card";
import { OfferButton, offerSlides } from "@/components/consumer/offer-button";
import { CONSUMER_ROUTES, isRouteId, payPlacePath } from "@/lib/consumer-route-contract";
import {
  TILE_ACTIONS,
  TILE_BAND,
  TILE_FOOT,
  TILE_FRAME,
  TILE_PHOTO,
  TILE_TEXT,
  TILE_TEXT_WITH_VOUCHERS,
} from "./catalog-tile-classes";

/**
 * A Google-only card has no Mesita page yet. Its tap is the explicit open
 * (MESITA-2298): the parent's `onOpenGoogle` runs get-or-create on the
 * Google Place ID and routes to the profile. Never a link, never a prefetch,
 * never Google Maps.
 */
function TileLink({
  href,
  google,
  onOpen,
  onTap,
  label,
  className,
  children,
}: {
  href: string;
  /** A Google-only card is a button, never a link to a page it has no row for. */
  google: boolean;
  /** The parent's explicit open for that button. */
  onOpen?: () => void;
  /** Any tap, either kind: the parent's analytics (MESITA-2384). */
  onTap?: () => void;
  label: string;
  className: string;
  children: ReactNode;
}) {
  if (google) {
    return (
      <button
        type="button"
        onClick={() => {
          onTap?.();
          onOpen?.();
        }}
        aria-label={`Open ${label}`}
        className={`${className} w-full text-left`}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={className} onClick={onTap}>
      {children}
    </Link>
  );
}

/**
 * One place, as one tile (Pato, MESITA-2364, MESITA-2373): the photo on top,
 * a white band below carrying three rows — name; $$ · category · stars;
 * Open or Closed · distance (MESITA-3229) — and two buttons, with the voucher
 * line under them when the place sells vouchers (MESITA-3312, in the coupon's
 * old spot, MESITA-3233). The buttons, Save and Share
 * (MESITA-2650, MESITA-2668). A Premier place wears the Premier mark
 * after its name, "Premier 2X" (MESITA-2925; Enriched has no guest mark). A Google-only card opens its profile
 * through `onOpenGoogle`, and its one button, Generate Profile, does the
 * same (MESITA-2843).
 */

export function CatalogTile({
  place,
  saved,
  onToggle,
  onOpenGoogle,
  onOpen,
  onShare,
  photoOverlay,
  className,
}: {
  place: Place;
  saved: boolean;
  onToggle: () => void;
  /** Any open of the tile, for analytics (MESITA-2384). */
  onOpen?: () => void;
  /** The explicit open for a Google-only card (get-or-create, then route). */
  onOpenGoogle?: () => void;
  /** Share override; a Mesita place shares its own page by default. */
  onShare?: () => void;
  /** Drawn over the photo: the score readout for now (MESITA-3053). */
  photoOverlay?: ReactNode;
  className?: string;
}) {
  const photo = cardPhoto(place);
  const placeholder = placePlaceholder(place);
  const google = isGoogleOnlyPlace(place);
  const href = placeHref(place.slug || place.id);
  // The card's facts, shared with the Search card (MESITA-2668): name;
  // $$ · category · stars; Open or Closed · distance. No zone on the tile. Each
  // cell hides when the place has none.
  const facts = cardFacts(place);
  // The green offer button (MESITA-3439) rotates the place's offers since
  // MESITA-3467: only what the place offers now, none = no button (a
  // Google-only card offers nothing).
  const slides = google ? [] : offerSlides(place);
  const vouchers = slides.length > 0;

  // The photo, or the category's emoji when there is none (MESITA-2667).
  const media = () =>
    photo ? (
      <SizedImage
        src={photo}
        size="card"
        alt=""
        fill
        sizes="(max-width: 448px) 66vw, 300px"
        className="object-cover object-center"
      />
    ) : (
      <div
        // A LIGHT NO-PHOTO FACE (Pato, MESITA-2664: "if no image ... try a
        // white background, let's see how it looks"): the light fill, not
        // the ink gradient. On it, THE CATEGORY'S EMOJI (MESITA-2667:
        // "instead of displaying that shitty thing display the emoji of the
        // category"), 48px, in place of the family's line icon.
        className="bg-muted text-muted-foreground absolute inset-0 flex items-center justify-center"
        data-placeholder={placeholder.kind}
      >
        {placeholder.kind === "emoji" ? (
          <span className="text-5xl leading-none select-none" aria-hidden>
            {placeholder.emoji}
          </span>
        ) : (
          <span
            className="font-display text-3xl font-bold tracking-tight"
            aria-hidden
          >
            {placeholder.text}
          </span>
        )}
      </div>
    );

  // SAVE, NOT LIKE (Pato, MESITA-2668: "instead of like use Save as word but
  // keep the heart"); the clock, the arrow and the star carry colour. The
  // rows and buttons are place-card.tsx, shared with the Search card.
  //
  // TWO BIG BUTTONS, SAVE AND SHARE (Pato, MESITA-2650: "add the button to
  // like and the button share; share must be almost everywhere to maximize
  // sharing and the virality of the app").
  //
  // THE PHOTO ABOUT 60%, THE TEXT THE REST (Pato, MESITA-3233: "return to 60%
  // image and 40% text or whatever"), every tile, a Google-only card too
  // (MESITA-2663): name; $$ · category · stars; Open or Closed · distance; then
  // Save and Share side by side (32px, 44px hit area), then the voucher line
  // when the place sells vouchers (MESITA-3312; the coupon that sat there
  // left with the discount product, MESITA-3299). 20px
  // lines and a 2px gap. The
  // photo is fully
  // shown and centred, nothing over it (MESITA-2369); the band under it is
  // plain white (MESITA-2658: the reflection went). The split went 45/55
  // (MESITA-2652), 66/34 (MESITA-2654) and 50/50 (MESITA-3229) on the way. The
  // boxes are catalog-tile-classes.ts, shared with the tile's loading
  // silhouette (MESITA-2701).
  return (
    <li className={cn(TILE_FRAME, className)}>
      <TileLink
        href={href}
        google={google}
        onOpen={onOpenGoogle}
        onTap={onOpen}
        label={place.name}
        className="focus-visible:ring-primary block outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <div className={cn("bg-muted", TILE_PHOTO)}>
          {media()}
          {photoOverlay}
        </div>
        {/* NO REFLECTION (Pato, MESITA-2658: "what actually looks better is
            removing the reflection of the place in the box"): a plain white
            band, the rows centred on it (MESITA-2645). MESITA-2657's
            ring and darker list ground stay out. */}
        <div className={TILE_BAND} data-tile-info>
          {/* ONE TYPE SCALE (Pato, MESITA-2645: "standardize fonts and sizes
              and spaces"): the place screen's own (packages/place-profile
              ui.ts). Inter everywhere, two sizes only: the name 16px
              semibold ink (PLACE_TITLE_CLASS); every other row 14px regular
              on a 20px line, full ink (place-card.tsx). TILE_TEXT leaves
              room for Save and Share. The mark follows the
              name. */}
          <div
            className={cn(
              "text-foreground",
              TILE_TEXT,
              vouchers && TILE_TEXT_WITH_VOUCHERS,
            )}
          >
            <p className="flex min-w-0 items-center gap-1 font-sans text-base leading-5 font-semibold tracking-tight">
              <span className="truncate">{place.name}</span>
              <PlaceMarks tier={place.boost_tier} ad={(place.boost_tier ?? 0) > 0} mesitaPay={place.mesita_pay === true} />
            </p>
            <KindRow facts={facts} />
            <HoursRow facts={facts} />
          </div>
        </div>
      </TileLink>
      {/* A Google-only card shows Generate Profile instead of Save and
          Share (Pato, MESITA-2843, reversing MESITA-2663): the tap is the
          card's own open. TILE_ACTIONS: 12px from the tile's sides AND its
          foot (MESITA-2668); it was 8px at the foot. */}
      {/* The foot lets taps through, so the voucher line opens the place like
          the rest of the card (MESITA-3246); only the buttons catch their own. */}
      <div className={cn(TILE_ACTIONS, TILE_FOOT, "pointer-events-none")}>
        <CardActions
          className="pointer-events-auto"
          name={place.name}
          saved={saved}
          onSave={onToggle}
          onShare={onShare ?? (() => void sharePlace(place))}
          onGenerate={
            google
              ? () => {
                  onOpen?.();
                  onOpenGoogle?.();
                }
              : undefined
          }
        />
        {vouchers ? <OfferButton href={href} payHref={isRouteId(place.id) ? payPlacePath(place.id) : CONSUMER_ROUTES.pay} name={place.name} slides={slides} className="pointer-events-auto" /> : null}
      </div>
    </li>
  );
}
