"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PlaceMarks, SizedImage } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { placeHref } from "@/lib/place-route";
import {
  cardPhoto,
  isGoogleOnlyPlace,
  placePlaceholder,
} from "@/lib/place-placeholder";
import { cn } from "@/lib/utils";
import { CardActions } from "@/components/consumer/place-card";
import { OfferButton, offerSlides } from "@/components/consumer/offer-button";
import {
  CONSUMER_ROUTES,
  isRouteId,
  payPlacePath,
} from "@/lib/consumer-route-contract";
import { PlaceFactsRun } from "./place-facts";
import { RAIL_CARD, RAIL_PHOTO } from "./place-grid-classes";

/**
 * One place in a Places 4.0 carousel (Pato, MESITA-3670: "more like open
 * table. one horizontal carousel for category … 1.5 items per wide
 * screen"): Places 3.0's card standing up.
 *
 *   ┌──────────────────┐
 *   │      photo       │   4:3
 *   ├──────────────────┤
 *   │ Name ✪           │
 *   │ $$ · Tacos · ★4.7│   the one run of facts (PlaceFactsRun)
 *   │ · Open · 0.4 km  │
 *   │[ Cashback +5% ]  │   only when the place has offers
 *   │[♡ Save][Share]   │   pinned to the bottom, so a row's buttons line up
 *   └──────────────────┘
 *
 * The photo and the text open the place (a Google-only card runs the
 * explicit get-or-create open); the offer and Save · Share catch their own
 * taps.
 */
export function PlaceRailCard({
  place,
  family,
  saved,
  onToggle,
  onShare,
  onOpen,
  onOpenGoogle,
}: {
  place: Place;
  family: string | null;
  saved: boolean;
  onToggle: () => void;
  onShare: () => void;
  onOpen?: () => void;
  onOpenGoogle?: () => void;
}) {
  const photo = cardPhoto(place);
  const placeholder = placePlaceholder(place);
  const google = isGoogleOnlyPlace(place);
  const slides = google ? [] : offerSlides(place);
  const focus = "focus-visible:ring-primary outline-none focus-visible:ring-2";

  const open = (children: ReactNode, className: string, label?: string) =>
    google ? (
      <button
        type="button"
        onClick={() => {
          onOpen?.();
          onOpenGoogle?.();
        }}
        aria-label={label}
        className={className}
      >
        {children}
      </button>
    ) : (
      <Link
        href={placeHref(place.slug || place.id)}
        onClick={onOpen}
        aria-label={label}
        className={className}
      >
        {children}
      </Link>
    );

  return (
    <li className={RAIL_CARD} data-rail-card>
      {open(
        photo ? (
          <SizedImage
            src={photo}
            size="card"
            alt=""
            fill
            sizes="(max-width: 640px) 66vw, 320px"
            className="object-cover object-center"
          />
        ) : (
          <div
            className="text-muted-foreground absolute inset-0 flex items-center justify-center"
            data-placeholder={placeholder.kind}
          >
            <span
              className={cn(
                "leading-none select-none",
                placeholder.kind === "emoji"
                  ? "text-4xl"
                  : "font-display text-2xl font-bold tracking-tight",
              )}
              aria-hidden
            >
              {placeholder.kind === "emoji"
                ? placeholder.emoji
                : placeholder.text}
            </span>
          </div>
        ),
        cn(RAIL_PHOTO, "block", focus),
        `Open ${place.name}`,
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        {open(
          <>
            <p className="flex min-w-0 items-start gap-1 text-sm leading-5 font-semibold tracking-tight">
              <span className="line-clamp-1">{place.name}</span>
              <PlaceMarks
                tier={place.boost_tier}
                ad={(place.boost_tier ?? 0) > 0}
              />
            </p>
            <PlaceFactsRun place={place} family={family} />
          </>,
          cn("flex min-w-0 flex-col gap-0.5 rounded-lg text-left", focus),
        )}
        <div className="mt-auto flex flex-col gap-2">
          <OfferButton
            href={placeHref(place.slug || place.id)}
            payHref={
              isRouteId(place.id) ? payPlacePath(place.id) : CONSUMER_ROUTES.pay
            }
            name={place.name}
            slides={slides}
            short
          />
          <CardActions
            name={place.name}
            saved={saved}
            onSave={onToggle}
            onShare={onShare}
            onGenerate={
              google
                ? () => {
                    onOpen?.();
                    onOpenGoogle?.();
                  }
                : undefined
            }
          />
        </div>
      </div>
    </li>
  );
}
