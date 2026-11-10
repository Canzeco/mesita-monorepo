"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Heart, Star } from "lucide-react";
import { PlaceMarks, SizedImage } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { placeHref } from "@/lib/place-route";
import {
  cardPhoto,
  isGoogleOnlyPlace,
  placePlaceholder,
} from "@/lib/place-placeholder";
import { cn } from "@/lib/utils";
import { cardFacts } from "@/components/consumer/place-card";
import { offerSlides } from "@/components/consumer/offer-button";
import {
  GRID_FACT_LINE,
  GRID_NAME_LINE,
  GRID_PHOTO,
  GRID_TEXT,
} from "./place-grid-classes";

/**
 * One place in Home's grid (Pato, MESITA-3658: "beautiful, simple, compact,
 * modular, display only relevant fields"): a square photo, the name, one
 * line of facts.
 *
 *   ┌────────♡┐
 *   │  photo  │   the heart saves; the pill is the place's first offer
 *   │[+5% …]  │
 *   └─────────┘
 *   Taquería Orinoco
 *   ★ 4.7 · Tacos · 1.1 km        "· Closed" only when it is closed
 *
 * Left off, on purpose: the price, the review count, the word Open, Share
 * and the wide offer button; the place screen has them all. The whole card
 * opens the place. A Google-only card has no Mesita page yet, so it is a
 * button that runs the parent's explicit open (MESITA-2298) and carries no
 * heart.
 */
export function PlaceGridCard({
  place,
  family,
  saved,
  onToggle,
  onOpen,
  onOpenGoogle,
}: {
  place: Place;
  /** The place's family word, or null where the chosen chip already says it. */
  family: string | null;
  saved: boolean;
  onToggle: () => void;
  /** Any open of the card, for analytics. */
  onOpen?: () => void;
  /** The explicit open for a Google-only card (get-or-create, then route). */
  onOpenGoogle?: () => void;
}) {
  const photo = cardPhoto(place);
  const placeholder = placePlaceholder(place);
  const google = isGoogleOnlyPlace(place);
  const facts = cardFacts(place);
  const offer = google ? undefined : offerSlides(place)[0];
  const cells = [family, facts.distance, facts.open === false ? "Closed" : null]
    .filter((c): c is string => c != null);

  const face: ReactNode = (
    <>
      <div className={GRID_PHOTO}>
        {photo ? (
          <SizedImage
            src={photo}
            size="card"
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, 220px"
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
        {offer ? (
          <span
            className={cn(
              "absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-xs leading-4 font-semibold",
              offer.tone,
            )}
            data-grid-offer
          >
            {offer.pill}
          </span>
        ) : null}
      </div>
      <div className={cn("text-foreground", GRID_TEXT)}>
        <p
          className={cn(
            "flex min-w-0 items-center gap-1 font-sans text-sm font-semibold tracking-tight",
            GRID_NAME_LINE,
          )}
        >
          <span className="truncate">{place.name}</span>
          <PlaceMarks tier={place.boost_tier} ad={(place.boost_tier ?? 0) > 0} />
        </p>
        {facts.rating || cells.length > 0 ? (
          <p
            className={cn(
              "flex min-w-0 items-center gap-1 font-sans text-xs",
              GRID_FACT_LINE,
            )}
          >
            {facts.rating ? (
              <span className="inline-flex shrink-0 items-center gap-0.5">
                <Star
                  className="fill-fact-star text-fact-star h-3 w-3 shrink-0"
                  aria-hidden
                />
                {facts.rating}
              </span>
            ) : null}
            {cells.length > 0 ? (
              <span className="truncate">
                {facts.rating ? "· " : ""}
                {cells.join(" · ")}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </>
  );

  const frame =
    "focus-visible:ring-primary block w-full rounded-xl text-left outline-none focus-visible:ring-2";

  return (
    <li className="relative min-w-0" data-grid-card>
      {google ? (
        <button
          type="button"
          onClick={() => {
            onOpen?.();
            onOpenGoogle?.();
          }}
          aria-label={`Open ${place.name}`}
          className={frame}
        >
          {face}
        </button>
      ) : (
        <Link
          href={placeHref(place.slug || place.id)}
          onClick={onOpen}
          className={frame}
        >
          {face}
        </Link>
      )}
      {google ? null : (
        // A 44px target around a 28px white disc, over the photo's corner.
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={saved}
          aria-label={
            saved
              ? `Remove ${place.name} from favorites`
              : `Add ${place.name} to favorites`
          }
          className="group absolute top-0 right-0 flex h-11 w-11 items-center justify-center outline-none"
          data-grid-save
        >
          <span className="bg-card text-foreground group-focus-visible:ring-primary flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition group-focus-visible:ring-2 group-active:scale-95">
            <Heart
              className={cn(
                "h-4 w-4",
                saved && "fill-destructive text-destructive",
              )}
              strokeWidth={2.25}
              aria-hidden
            />
          </span>
        </button>
      )}
    </li>
  );
}
