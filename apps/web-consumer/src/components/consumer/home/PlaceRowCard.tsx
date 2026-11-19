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
import { ROW_INFO, ROW_PAIR, ROW_PHOTO } from "./place-grid-classes";
import { PlaceFactsLines } from "./place-facts";

/**
 * One place in Places 3.0 (Pato, MESITA-3662: "image at the left and
 * information at the right, two squares, information with buttons"):
 *
 *   ┌─────────┐ ┌────────────────┐
 *   │  photo  │ │ Name ✪          │   16px, up to two lines, Premier seal
 *   │         │ │ Taco Restaurant │   one fact per line, 14px (MESITA-4418)
 *   │         │ │ $$ · ★4.7 (8.6K)│
 *   │         │ │ ◷ Open · until 3│
 *   │         │ │ ➤ Tec · 0.4 km  │
 *   │         │ │[Welcome +100%]  │   every offer as a chip (MESITA-4207)
 *   │         │ │[Small +10%] …   │
 *   └─────────┘ │[♡ Save][Share]  │
 *               └────────────────┘
 *
 * The photo square and the text open the place; Save and Share are the
 * shared CardActions (a Google-only place gets Generate Profile instead), so
 * a tap on them never navigates. THE PHOTO STAYS CLEAN (Pato, MESITA-3664:
 * "remove the offer icon from the image. keep the image clean.
 * you have a lot of space at the right. fucking use it"): the offers are the
 * offer chips in the info square, just above Save · Share, one per voucher
 * this guest can buy (MESITA-4207; the rotating OfferButton from MESITA-3665
 * before); a chip opens the place's Offers with that voucher ticked.
 */
export function PlaceRowCard({
  place,
  saved,
  onToggle,
  onShare,
  onOpen,
  onOpenGoogle,
}: {
  place: Place;
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
  const slides = google ? [] : offerSlides(place);

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
        {/* THE WHOLE SQUARE OPENS THE PROFILE (Pato, MESITA-3797: "all this
            box must be clickable … there is a dead spot between name and
            buttons"): the name's link stretches over the square (after:
            inset-0); the offer and Save · Share sit above it on their own. */}
        {open(
          <>
            {/* BIGGER (Pato, MESITA-4418: "make the fucking text bigger"):
                the name at 16px over one fact per line at 14px. */}
            <p className="flex min-w-0 items-start gap-1 text-base leading-snug font-semibold tracking-tight">
              <span className="line-clamp-2">{place.name}</span>
              <PlaceMarks
                tier={place.boost_tier}
                ad={(place.boost_tier ?? 0) > 0}
              />
            </p>
            <PlaceFactsLines place={place} />
          </>,
          cn(
            "flex min-w-0 flex-col gap-0.5 rounded-lg text-left after:absolute after:inset-0 after:rounded-r-2xl after:content-['']",
            focus,
          ),
        )}
        {/* ONE BUTTON GRID (Pato, MESITA-3665: "fix the spacing between the
            boxes buttons, like keep an ordered grid"): the offer line and
            Save · Share share one block pinned to the square's bottom, 8px
            apart both ways, the gap Save and Share already keep. */}
        {/* NO DEAD GAPS (autoplan design review, MESITA-4207): the block lets
            taps between chips through to the name's stretched link (the dead
            spot MESITA-3797 removed); only the chips and Save · Share catch them. */}
        <div className="pointer-events-none relative z-10 mt-auto flex flex-col gap-2">
          {/* ONE SWITCHING BOX (MESITA-4219): every offer, moving; nothing
              when the place sells none here. Chips in MESITA-4207. */}
          <OfferButton href={placeHref(place.slug || place.id)} name={place.name} slides={slides} />
          <div className="pointer-events-auto">
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
      </div>
    </li>
  );
}
