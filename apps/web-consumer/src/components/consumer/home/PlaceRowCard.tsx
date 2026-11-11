"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Clock, Star } from "lucide-react";
import { PlaceMarks, SizedImage } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { placeHref } from "@/lib/place-route";
import {
  cardPhoto,
  isGoogleOnlyPlace,
  placePlaceholder,
} from "@/lib/place-placeholder";
import { cn } from "@/lib/utils";
import { CardActions, cardFacts } from "@/components/consumer/place-card";
import { OfferButton, offerSlides } from "@/components/consumer/offer-button";
import {
  CONSUMER_ROUTES,
  isRouteId,
  payPlacePath,
} from "@/lib/consumer-route-contract";
import { ROW_INFO, ROW_PAIR, ROW_PHOTO } from "./place-grid-classes";

/**
 * One place in Places 3.0 (Pato, MESITA-3662: "image at the left and
 * information at the right, two squares, information with buttons"):
 *
 *   ┌─────────┐ ┌──────────────┐
 *   │  photo  │ │ Name          │   name on up to two lines
 *   │         │ │ $$ · Tacos    │
 *   │         │ │ ★ 4.7 (8.6K)  │
 *   │         │ │ ◷ Open · 3.3 km│
 *   │         │ │[ +5% Cashback ]│   every offer in turn, only when it has one
 *   └─────────┘ │[♡ Save][Share]│
 *               └──────────────┘
 *
 * The photo square and the text open the place; Save and Share are the
 * shared CardActions (a Google-only place gets Generate Profile instead), so
 * a tap on them never navigates. THE PHOTO STAYS CLEAN (Pato, MESITA-3664:
 * "remove the cashback icon from the fucking image. keep the image clean.
 * you have a lot of space at the right. fucking use it"): the offers are the
 * shared rotating OfferButton in the info square, just above Save · Share,
 * cycling every offer in its own colour (MESITA-3665); a tap goes where the
 * offer on screen points, the place's bill or its Rewards section.
 */
export function PlaceRowCard({
  place,
  family,
  saved,
  onToggle,
  onShare,
  onOpen,
  onOpenGoogle,
}: {
  place: Place;
  /** The place's family word, or null where the chosen chip already says it. */
  family: string | null;
  saved: boolean;
  onToggle: () => void;
  onShare: () => void;
  /** Any open of the card, for analytics. */
  onOpen?: () => void;
  /** The explicit open for a Google-only card (get-or-create, then route). */
  onOpenGoogle?: () => void;
}) {
  const photo = cardPhoto(place);
  const placeholder = placePlaceholder(place);
  const google = isGoogleOnlyPlace(place);
  const facts = cardFacts(place);
  const slides = google ? [] : offerSlides(place);
  // The family word on Top, the place's own kind under a family chip.
  const kind = family ?? facts.kind ?? null;

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

  const focus = "focus-visible:ring-primary outline-none focus-visible:ring-2";

  return (
    <li className={ROW_PAIR} data-row-card>
      {open(
        <>
          {photo ? (
            <SizedImage
              src={photo}
              size="card"
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 240px"
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
          )}
        </>,
        cn(ROW_PHOTO, "block", focus),
        `Open ${place.name}`,
      )}

      <div className={ROW_INFO}>
        {open(
          <>
            <p className="flex min-w-0 items-start gap-1 text-sm leading-5 font-semibold tracking-tight">
              <span className="line-clamp-2">{place.name}</span>
              <PlaceMarks
                tier={place.boost_tier}
                ad={(place.boost_tier ?? 0) > 0}
              />
            </p>
            {facts.price || kind ? (
              <p className="text-muted-foreground truncate text-xs leading-5">
                {facts.price ? (
                  <span className="text-fact-price font-semibold">
                    {facts.price}
                  </span>
                ) : null}
                {facts.price && kind ? " · " : null}
                {kind}
              </p>
            ) : null}
            {facts.rating ? (
              <p className="text-muted-foreground flex items-center gap-1 text-xs leading-5">
                <Star
                  className="fill-fact-star text-fact-star h-3 w-3 shrink-0"
                  aria-hidden
                />
                <span className="text-foreground">{facts.rating}</span>
                {facts.reviews ? <span>({facts.reviews})</span> : null}
              </p>
            ) : null}
            {facts.open !== null || facts.distance ? (
              <p className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs leading-5">
                {facts.open !== null ? (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1",
                      facts.open ? "text-fact-open" : "text-fact-closed",
                    )}
                  >
                    <Clock className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                    {facts.open ? "Open" : "Closed"}
                  </span>
                ) : null}
                {facts.open !== null && facts.distance ? <span>·</span> : null}
                {facts.distance ? (
                  <span className="truncate">{facts.distance}</span>
                ) : null}
              </p>
            ) : null}
          </>,
          cn("flex min-w-0 flex-col gap-0.5 rounded-lg text-left", focus),
        )}
        {/* ONE BUTTON GRID (Pato, MESITA-3665: "fix the spacing between the
            boxes buttons, like keep an ordered grid"): the offer line and
            Save · Share share one block pinned to the square's bottom, 8px
            apart both ways, the gap Save and Share already keep. */}
        <div className="mt-auto flex flex-col gap-2">
          {/* EVERY OFFER, MOVING (Pato, MESITA-3665: "make the green
              buttons offers moving and switching across all the offers with
              different colors"): the shared OfferButton, each offer in its
              own colour on the shared beat, short words for this box. */}
          <OfferButton
            href={placeHref(place.slug || place.id)}
            payHref={
              isRouteId(place.id) ? payPlacePath(place.id) : CONSUMER_ROUTES.pay
            }
            name={place.name}
            slides={slides}
            compact
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
