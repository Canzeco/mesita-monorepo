"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { EnrichedBadge } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { isEnrichedPlace } from "@/lib/place-enriched";
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
 * a white band below carrying three rows — name; category · $$ · stars;
 * hours · distance (MESITA-2645) — and two buttons, Save and Share
 * (MESITA-2650, MESITA-2668). An enriched place wears the Enriched mark
 * after its name (MESITA-2296). A Google-only card opens its profile
 * through `onOpenGoogle`; its Save and Share create the place first.
 */

export function CatalogTile({
  place,
  saved,
  onToggle,
  onOpenGoogle,
  onOpen,
  onShare,
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
  className?: string;
}) {
  const photo = cardPhoto(place);
  const placeholder = placePlaceholder(place);
  const google = isGoogleOnlyPlace(place);
  const href = placeHref(place.slug || place.id);
  // The card's facts, shared with the Search card (MESITA-2668): name;
  // category · $$ · stars; hours · distance. No zone on the tile. Each cell
  // hides when the place has none.
  const facts = cardFacts(place);

  // The photo, or the category's emoji when there is none (MESITA-2667).
  const media = () =>
    photo ? (
      <Image
        src={photo}
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
  // TWO BIG BUTTONS, LIKE AND SHARE (Pato, MESITA-2650: "add the button to
  // like and the button share; share must be almost everywhere to maximize
  // sharing and the virality of the app").
  //
  // PHOTO 60%, CONTENT 40%, FOUR ROWS (Pato, MESITA-2655: "better 40% and
  // 60%, and use the space for 4 rows"): name; category · $$ · stars;
  // hours · distance; then Like and Share side by side (28px, 44px hit
  // area). 20px lines and a 2px gap so the four fit. Supersedes the next
  // paragraph's 66/34 and stacked buttons.
  //
  // PHOTO 66%, CONTENT 34% (Pato, MESITA-2654: "image must be 66% of
  // square, the rest 33% is for content"), every tile. The band is too short
  // for a button row under three text rows, so Like and Share stack at its
  // right, centred, 84px wide; the rows truncate before them. The
  // reflection is the photo's height: 66/34 = 194.12% of the band.
  //
  // EVERY TILE IS SQUARE (MESITA-2652: "the dimensions must be square, and
  // the buttons shorter"): a Mesita tile gives the photo the top 45% and the
  // band 55% (the reflection is the photo's height, 45/55 = 81.82% of the
  // band, so it still mirrors from the foot); a Google-only card, which has
  // no page to share or save, keeps 60/40 and no buttons.
  //
  // ONE square (Pato, MESITA-2369, MESITA-2373): the photo is the top 60%,
  // fully shown and centred — nothing lies over it. The bottom 40% is its
  // REFLECTION: a 60%-tall copy flipped so its foot meets the photo's foot,
  // under an 80% paper layer, three rows on it in dark text. No border; the
  // corners are rounded-2xl — and the photo, the band and its blur layer
  // carry the same radius themselves, because a backdrop-blur layer escapes
  // its parent's rounded clip and painted the bottom corners square
  // (MESITA-2429). Like and Share sit on the band's foot.
  return (
    <li
      className={cn(
        // A 1px grey hairline around each tile (Pato, MESITA-2661: "add a
        // really small border, gray, to each box").
        "border-foreground/35 relative isolate aspect-square min-w-0 overflow-hidden rounded-2xl border",
        className,
      )}
    >
      <TileLink
        href={href}
        google={google}
        onOpen={onOpenGoogle}
        onTap={onOpen}
        label={place.name}
        className="focus-visible:ring-primary absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <div
          className={cn(
            "bg-muted absolute inset-x-0 top-0 overflow-hidden rounded-t-2xl",
            "h-[60%]",
          )}
        >
          {media()}
        </div>
        {/* The reflection: bottom 40%, the photo mirrored from its foot under
            80% paper (MESITA-2375), the three rows centred on it (MESITA-2645). */}
        <div
          className={cn(
            // NO REFLECTION (Pato, MESITA-2658: "what actually looks better is
            // removing the reflection of the place in the box"): a plain
            // white band. MESITA-2657's ring and darker list ground stay out.
            "bg-paper absolute inset-x-0 bottom-0 overflow-hidden rounded-b-2xl",
            "h-[40%]",
          )}
          data-tile-info
        >
          {/* ONE TYPE SCALE (Pato, MESITA-2645: "standardize fonts and sizes
              and spaces"): the place screen's own (packages/place-profile
              ui.ts). Inter everywhere, two sizes only: the name 16px
              semibold ink (PLACE_TITLE_CLASS); every other row 14px regular
              on a 20px line, full ink (place-card.tsx). 12px side padding;
              the rows centre in what Save and Share leave (44px: the 32px
              row and its 12px foot), so the gap over the name and the gap
              over the buttons match. The mark follows the name. */}
          <div className="text-foreground relative flex h-full flex-col justify-center gap-0.5 px-3 pb-11">
            <p className="flex min-w-0 items-center gap-1 font-sans text-base leading-5 font-semibold tracking-tight">
              <span className="truncate">{place.name}</span>
              {isEnrichedPlace(place) ? <EnrichedBadge /> : null}
            </p>
            <KindRow facts={facts} />
            <HoursRow facts={facts} />
          </div>
        </div>
      </TileLink>
      {/* Google-only cards get Save and Share too (Pato, MESITA-2663:
          "keep the save and share button even if no profile yet, just
          create the profile and then trigger it"); the parent's handlers
          get-or-create first. 12px from the tile's sides AND its foot
          (MESITA-2668: "its not the same vertical margin as horizontal
          margin"); it was 8px at the foot. */}
      <CardActions
        name={place.name}
        saved={saved}
        onSave={onToggle}
        onShare={onShare ?? (() => void sharePlace(place))}
        className="absolute inset-x-3 bottom-3"
      />
    </li>
  );
}
