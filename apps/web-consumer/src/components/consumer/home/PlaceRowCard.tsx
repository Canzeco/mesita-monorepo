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
import { placeReservePath } from "@/lib/consumer-route-contract";
import type { LiveTable } from "@/lib/use-live-reservations";
import { CardActions } from "@/components/consumer/place-card";
import { PlaceBannerRow, offerSlides } from "@/components/consumer/offer-button";
import { ROW_INFO, ROW_PAIR, ROW_PHOTO } from "./place-grid-classes";
import { PlaceFactsLines } from "./place-facts";
import { ordinal } from "@/lib/catalog-modes";
import { notePremierAd } from "@/lib/premier-ads";
import { PremierAdBeacon } from "@/components/consumer/PremierAdBeacon";

/** Four significant digits (MESITA-4450: Popularity runs into the tens,
 *  Proximity can sit under 0.01); under 0.0001 in scientific form so a
 *  tiny value never reads 0. Anything missing reads "n/a". */
function scoreNumber(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "n/a";
  if (n === 0) return "0";
  if (Math.abs(n) < 1e-4) return n.toExponential(2);
  return String(Number(n.toPrecision(4)));
}

/**
 * TEMPORARY (Pato, MESITA-4449: "Display score on top of image to see how
 * much of each hyperparams"): the server's score parts on the photo, so the
 * Discovery knobs can be judged on a phone. Every number is `place.area`
 * (MESITA-2379); nothing is computed here. Final is the EF's
 * Proximity × Popularity × Premier boost, read with the row's lane recipe
 * (MESITA-4454, H1): Premier is premierFactor ^ PremierExp, so ×1 on every
 * organic row. The top line is the place's merged rank before the first
 * page's shuffle and its shown position ("#3 → 1st"), and "Ad" on an
 * ad-slot row. The Lane line names the place's lane (MESITA-4465, Pato:
 * "mention the lane too, if organic or inorganic"): Inorganic in an
 * inorganic slot, the Family lane's name on a family chip (MESITA-4517),
 * Organic otherwise. Google and Foursquare (raw score, then its
 * multiplier; "—" when missing) are Popularity's two halves (MESITA-4517).
 * No `area`, no label. Discovery's Score overlay switch (MESITA-4757,
 * `general.showScores`) turns it off without a deploy.
 * TO REMOVE: delete this, its one use and the `showScores` prop.
 */
/** A lane key's name on the tag (MESITA-4517). */
const LANE_NAMES: Record<string, string> = {
  catalogNearbyOrganic: "Organic Nearby Lane",
  catalogNearbyInorganic: "Inorganic Nearby Lane",
  catalogNearbyBoth: "Organic Local Favorites Lane",
  catalogNearbyBothInorganic: "Inorganic Local Favorites Lane",
  catalogFamilyClose: "Organic Nearby Lane",
  catalogFamilyCloseInorganic: "Inorganic Nearby Lane",
  catalogFamilyWellKnown: "Organic Popular Lane",
  catalogFamilyWellKnownInorganic: "Inorganic Popular Lane",
  catalogFamilyBoth: "Organic Local Favorites Lane",
  catalogFamilyBothInorganic: "Inorganic Local Favorites Lane",
  catalogPopularOrganic: "Organic Popular Lane",
  catalogPopularInorganic: "Inorganic Popular Lane",
  catalogPopularBoth: "Organic Local Favorites Lane",
  catalogPopularBothInorganic: "Inorganic Local Favorites Lane",
};

function ScoreLabel({
  area,
  ad,
  lane,
  rank,
}: {
  area: Place["area"];
  ad: boolean;
  lane?: string;
  rank?: { pre: number | null; shown: number } | null;
}) {
  if (!area) return null;
  const head = rank
    ? rank.pre !== null
      ? `#${rank.pre} → ${ordinal(rank.shown)}`
      : ordinal(rank.shown)
    : null;
  const rows: Array<[string, string]> = [
    ["Lane", (lane && LANE_NAMES[lane]) || (ad ? "Inorganic" : "Organic")],
    // Popularity = Google × the Foursquare boost (MESITA-4515, MESITA-4517).
    // The row shows only our boost, not Foursquare's raw 0–1 score (Pato,
    // MESITA-4692: "show boost implicit").
    ...(area.google !== undefined ? [["Google", scoreNumber(area.google)] as [string, string]] : []),
    ...(area.foursquare
      ? [["Foursquare", `×${scoreNumber(area.foursquare.boost)}`] as [string, string]]
      : []),
    ["Popularity", scoreNumber(area.signals.popularity)],
    ["Proximity", scoreNumber(area.signals.proximity)],
    ["Premier", `×${scoreNumber(area.premierBoost ?? area.selectedFactor ?? 1)}`],
    ["Final", scoreNumber(area.final)],
  ];
  return (
    <dl
      className="pointer-events-none absolute top-2 left-2 grid grid-cols-[auto_auto] gap-x-2 rounded-md bg-black/70 px-2 py-1 type-label font-mono leading-tight text-white tabular-nums"
      aria-label="Score breakdown (temporary)"
      data-score-label
    >
      {head || ad ? (
        <div className="contents font-bold">
          <dt>{ad ? "Ad" : ""}</dt>
          <dd className="text-right">{head ?? ""}</dd>
        </div>
      ) : null}
      {rows.map(([k, v]) => (
        <div key={k} className={cn("contents", k === "Final" && "font-bold")}>
          <dt>{k}</dt>
          <dd className="text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

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
  table = null,
  ad = false,
  rank = null,
  showScores = true,
}: {
  place: Place;
  /** The row sits in an ad slot (MESITA-4454, H4): its id is in the rank's
   *  `adIds`. A Premier place in an organic slot passes false and wears its
   *  seal only. The place link carries no ad context (M7). */
  ad?: boolean;
  /** The temporary score label's "#3 → 1st" (H1): the merged rank before
   *  the shuffle (null past the first page) and the shown position. */
  rank?: { pre: number | null; shown: number } | null;
  /** Discovery's Score overlay switch (MESITA-4757): false hides the
   *  temporary score label. */
  showScores?: boolean;
  /** The guest's live table here, if any (MESITA-4453). */
  table?: LiveTable | null;
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
  const reservable = !google && place.reservations_enabled !== false;

  const openCard = () => {
    if (ad) notePremierAd(place.id, "tap");
    onOpen?.();
  };
  const open = (children: ReactNode, className: string, label?: string) =>
    google ? (
      <button
        type="button"
        onClick={() => {
          openCard();
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
        onClick={openCard}
        aria-label={label}
        className={className}
      >
        {children}
      </Link>
    );

  const focus = "focus-visible:ring-primary outline-none focus-visible:ring-2";

  return (
    <li className={cn(ROW_PAIR, "relative")} data-row-card>
      <PremierAdBeacon placeId={place.id} ad={ad} />
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
                    : "text-2xl font-bold tracking-tight",
                )}
                aria-hidden
              >
                {placeholder.kind === "emoji"
                  ? placeholder.emoji
                  : placeholder.text}
              </span>
            </div>
          )}
          {showScores ? (
            <ScoreLabel area={place.area} ad={ad} lane={place.lane} rank={rank} />
          ) : null}
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
              {/* "Ad" ONLY IN AN AD SLOT (MESITA-4454, H4): the seal for
                  every Premier place, "· Ad" only when the rank put it in
                  an ad slot; it was every Premier row before. */}
              <PlaceMarks tier={place.boost_tier} ad={ad} />
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
          {/* ONE OR TWO (Pato, 2026-11-26, MESITA-5010): both share the row;
              a place with only one of them gets that one, full width. */}
          <PlaceBannerRow
            name={place.name}
            placeId={place.id}
            slides={slides}
            hours={place.hours}
            timezone={place.timezone}
            reservable={reservable}
            reserveLabel={table && !google ? (table.confirmed ? "Booked" : "Booking") : undefined}
            reserveDetail={table?.when}
            reserveHref={placeReservePath(place.slug || place.id)}
            offerHref={placeHref(place.slug || place.id)}
            className="pointer-events-auto"
          />
          <div className="pointer-events-auto">
          <CardActions
            // White with a hairline, not grey (MESITA-4432).
            buttonClassName="bg-card border-border hover:bg-muted border"
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
