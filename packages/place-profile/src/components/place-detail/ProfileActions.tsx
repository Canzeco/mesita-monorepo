"use client";

import {
  CalendarCheck,
  ChevronRight,
  Tag,
  Heart,
  Map as MapIcon,
  Phone,
  Rocket,
  Share2,
  type LucideIcon,
} from "lucide-react";
import type React from "react";
import { useMemo, useState, useSyncExternalStore } from "react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";
import { mesitaRowState } from "../../lib/mesita-row";
import { reserveTimes } from "../../lib/reserve-times";
import { OfferTrack, offersLabel, ROW_TICK_MS, ROW_TICKS_PER_CHANGE, useOfferSlide, type OfferSlide } from "./offer-slides";
import { OffTileSheet, type OffTile } from "./OffTileSheet";
import { PLACE_PILL_CLASS } from "../../lib/ui";
import { buildDirectionsUrl } from "../../lib/maps-link";


// TWO ROWS OF TILES (Pato's sketches, MESITA-3419 then MESITA-4151):
//
//   [ Save ] [ Maps ] [ Contact ] [ Share ] [ Upgrade ]   black, glyph over label (MESITA-3581)
//   [     Reserve      ] [       Offers        ]          pinned, halves (MESITA-4159)
//
// ROW 2 IS TWO BUTTONS (Pato, MESITA-4151: "showing the wallet balance there
// and the pay button is not really relevant ... pay is already in the bottom
// menu, and wallet too ... reservations button must be black, and the offers
// button must be moving ... just like the banner in home"). Reserve is the
// black ink tile, always drawn (MESITA-3078): live where the place takes
// bookings, an "Off" pill and the Off sheet where it doesn't. Offers is
// a black tile whose words rotate through every offer the place sells, whole
// (MESITA-4155): "Prepay $200MX, Get $220MX" for each voucher, sizes first,
// then "Pay with Mesita, Get 5% Back"; a slide every 2s on Home's beat.
// The slide under the finger is the door: a voucher opens the Offers page at
// its section, Pay opens Pay. With no offer here it is the grey Off tile.
// Four tiles (Reserve · Prepay · Wallet · Pay) from MESITA-3574 to 4150.
//
// Row 1: Save is the heart (MESITA-2521); once saved only the heart turns
// red (MESITA-2635). Maps opens Google Maps routing to the place
// (MESITA-2619). Upgrade opens the host's sheet on every place (MESITA-3201).
// Every button is 44px or more (MESITA-2324). A missing callback leaves its
// button visible and inert, so admin's preview keeps the consumer's shape.

// THE TILES ARE ONE STEP DARKER THAN --fill (Pato, MESITA-2647: "make the
// four gray buttons a bit darker, just a bit, minimum"): the border grey at
// 60% over the white band ≈ #e9e9e9 (bg-muted is #efefef); hover 80%.
// THE ROWS' LAYOUT AND A TILE'S BOX ARE WRITTEN ONCE (Pato, MESITA-2701:
// "the placeholders must be similar to the page you are loading, like the
// sizes"): read here and by ProfileSummarySkeleton, which lays its bones
// out in them. The ink row is the tiles' 56px.

/** The tiles row's wrapper in the band (the Mesita row rides in the sticky
 *  block since MESITA-3330; ONE GAP EVERY WAY, Pato, MESITA-2823). */
export const PROFILE_ACTIONS_CLASS = "flex flex-col gap-2";
/** Row 1: five grey tiles, 8px apart, Save · Maps · Contact · Share ·
 *  Upgrade (Pato, MESITA-3426: "maybe do return the 5 and 3 buttons grid";
 *  three a row from MESITA-3419 to MESITA-3425). */
export const PROFILE_TILES_ROW_CLASS = "grid grid-cols-5 gap-2";
/** A tile's box: 52px, the glyph over the label (MESITA-3426: five a row is
 *  ~59px wide on a 360px phone, too narrow for them side by side). It was
 *  40px with the glyph beside the label (MESITA-3421, MESITA-3423) and 56px
 *  glyph-over-label before that. */
export const PROFILE_TILE_BOX_CLASS =
  "flex h-13 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1";
/** Row 2, pinned: Reserve half, Offers half (Pato, MESITA-4169: "each of
 *  the reserve and offers buttons to be 50% and 50%"); 2/5 · 3/5 on the
 *  five-tile grid in MESITA-4163 and MESITA-4156, halves in MESITA-4159. */
export const PROFILE_MESITA_ROW_CLASS = "grid grid-cols-2 gap-2";

/** A Mesita tile's box: the grey tile's own (MESITA-3419, MESITA-3421). */
export const PROFILE_MESITA_TILE_BOX_CLASS = PROFILE_TILE_BOX_CLASS;

/** THE ROW IS SEGMENTED (Pato, 2026-11-16, MESITA-4164, variation 6 of ten):
 *  each tile is two parts, the glyph over the label on the ink of the row
 *  above at the left, and the moving time or offer filling the rest of the
 *  tile edge to edge in colour, OpenTable red for the time, Link green for
 *  the offer; the tile's corners clip it. An inset 32px chip before
 *  (MESITA-4160..4163). */
const ROW_TILE = "bg-foreground text-paper flex-row items-stretch gap-0 overflow-hidden p-0 text-xs font-semibold transition hover:opacity-90 active:scale-[0.99]";
// The glyph over the label, as in the row above, in one fixed width.
// The glyph only (Pato, MESITA-4167, variation 6 "Caption + big"); the
// words "Reserve" and "Offers" stay in the spoken labels.
const ROW_LEAD = "flex w-10 shrink-0 items-center justify-center";
// The moving words big (Pato, MESITA-4165: "make the moving text bigger"):
// 15px, 11px before.
const ROW_CHIP = "relative min-w-0 flex-1 overflow-hidden text-lg leading-tight font-extrabold tabular-nums";
const RESERVE_CHIP = "bg-[#DA3743] text-white";
const OFFERS_CHIP = "bg-green-400 text-neutral-950";
const OFF_CHIP = "bg-paper/15 text-paper/70 flex items-center justify-center";

// The reservation button's tones: green once confirmed, grey while booking.
const MONEY_TONE = {
  green: "bg-green-400 text-neutral-950",
  off: "bg-border/60 text-foreground",
} as const;

const tileBtn = cn(
  PROFILE_TILE_BOX_CLASS,
  "bg-foreground text-paper hover:opacity-90 text-xs font-semibold transition active:scale-[0.99]",
);

function ActionTile({
  Icon,
  label,
  live,
  onClick,
  pressed,
  ariaLabel,
  dialog = false,
  className,
  iconClassName,
  dataDirectionsUrl,
  disabled = false,
  children,
}: {
  Icon?: LucideIcon;
  label: string;
  live: boolean;
  onClick?: () => void;
  pressed?: boolean;
  ariaLabel?: string;
  dialog?: boolean;
  className?: string;
  iconClassName?: string;
  /** The Directions tile carries its Google Maps link for inspection. */
  dataDirectionsUrl?: string;
  /** A blocked tile (Reserve where the place takes no bookings): drawn,
   *  never hidden (MESITA-3078), `disabled`, faded, no hover. */
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      {...(live && onClick
        ? {
            onClick,
            ...(pressed !== undefined ? { "aria-pressed": pressed } : {}),
            ...(dialog ? { "aria-haspopup": "dialog" as const } : {}),
          }
        : inertButtonProps(false))}
      aria-label={ariaLabel}
      data-directions-url={dataDirectionsUrl}
      disabled={disabled}
      // NEVER LOOKS BLOCKED (Pato, MESITA-3423: "don't make the reserve button
      // look blocked. make it gray too"): a tile with nothing behind it is the
      // same grey tile; only the screen reader hears why (aria-label).
      className={cn(tileBtn, disabled && "hover:opacity-100 active:scale-100", className)}
    >
      {children ??
        (Icon ? (
          <Icon
            className={cn("h-[18px] w-[18px] shrink-0", iconClassName)}
            strokeWidth={2.25}
          />
        ) : null)}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

export function ProfileActions({
  place,
  actions,
  className,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
  className?: string;
}) {
  const hasWhatsApp = Boolean(place.channels.whatsapp_url);
  const saved = actions?.saved === true;
  const onSave = actions?.onSave;
  const onContact = actions?.onContact;
  const onShare = actions?.onShare;
  const onOpenLink = actions?.onOpenLink;
  const onBoost = actions?.onBoost;
  const directionsUrl = buildDirectionsUrl(place);

  return (
    <div className={cn(PROFILE_ACTIONS_CLASS, className)}>
      <div className={PROFILE_TILES_ROW_CLASS} data-profile-actions="tiles">
        <ActionTile
          Icon={Heart}
          // SAVE, NOT LIKE (Pato, MESITA-2668: "use word save instead of
          // liked but keep the heart"), as on the Home tile and the Search
          // card.
          label={saved ? "Saved" : "Save"}
          live={Boolean(onSave)}
          onClick={onSave}
          pressed={saved}
          ariaLabel={saved ? "Remove from favorites" : "Add to favorites"}
          // LIKED IS A RED HEART, NOT A RED TILE (Pato, MESITA-2635: "that
          // red is just too red"): the tile stays grey like its neighbours
          // and only the glyph fills, the way Instagram marks a like.
          iconClassName={cn(saved && "fill-destructive text-destructive")}
        />
        <ActionTile
          // The folded map again (Pato, MESITA-2669: "MAYBE for directions do
          // use a map"), first worn in MESITA-2649. The car (MESITA-2640,
          // MESITA-2668), Signpost (MESITA-2638), Route (MESITA-2635) and the
          // paper plane each lived a night. Imported as MapIcon so it never
          // shadows the global Map.
          Icon={MapIcon}
          label="Maps"
          live={Boolean(onOpenLink)}
          onClick={onOpenLink ? () => onOpenLink(directionsUrl) : undefined}
          ariaLabel="Directions in Google Maps"
          dataDirectionsUrl={directionsUrl}
        />
        <ActionTile
          label="Contact"
          live={Boolean(onContact)}
          onClick={onContact}
          ariaLabel="Contact"
          dialog
        >
          {hasWhatsApp ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/channels/whatsapp.svg"
              alt=""
              aria-hidden
              className="h-[18px] w-[18px] shrink-0"
            />
          ) : (
            <Phone className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} />
          )}
        </ActionTile>
        <ActionTile
          Icon={Share2}
          label="Share"
          live={Boolean(onShare)}
          onClick={onShare}
          ariaLabel="Share"
        />
        <ActionTile
          Icon={Rocket}
          label="Upgrade"
          live={Boolean(onBoost)}
          onClick={onBoost}
          ariaLabel="Upgrade this place"
        />
      </div>
    </div>
  );
}

/** THE MESITA ROW, PINNED (Pato, MESITA-3330: "the dark buttons must not be
 *  scrollable, those stuck at the top"): Reserve · Offers ride in
 *  PlaceDetailBody's sticky block with the tab strip; the black tiles above
 *  scroll away with the summary. */
export function MesitaActions({
  place,
  actions,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
}) {
  const row = mesitaRowState(place, actions?.vouchersLoading === true);
  // AN OFF TILE STILL ANSWERS (Pato, MESITA-3583): it opens one sheet saying why.
  const [offOpen, setOffOpen] = useState<OffTile | null>(null);
  const onReserve = actions?.onReserve;
  const onOpenRewards = actions?.onOpenRewards;
  const onPay = actions?.onPay;
  // The door a slide opens: its Offers section, or Pay for the cashback.
  const openSlide = (slide: OfferSlide) => {
    if (slide.section) return onOpenRewards ? () => onOpenRewards(slide.section!) : undefined;
    return onPay;
  };
  return (
    <div className="flex flex-col gap-2">
    <div className={PROFILE_MESITA_ROW_CLASS} data-profile-actions="mesita">
      {offOpen ? (
        <OffTileSheet tile={offOpen} line={offOpen === "offers" ? row.offers.note : undefined} onClose={() => setOffOpen(null)} />
      ) : null}
      {row.reserve.works ? (
        <ReserveTile place={place} onReserve={onReserve} />
      ) : (
        <button
          type="button"
          onClick={() => setOffOpen("reserve")}
          aria-haspopup="dialog"
          aria-label="Reserve, off: this place doesn't offer reservations"
          className={cn(PROFILE_MESITA_TILE_BOX_CLASS, ROW_TILE)}
        >
          <span className={ROW_LEAD}>
            <CalendarCheck className={MESITA_TILE_ICON} strokeWidth={2.25} />
            <span className="sr-only">Reserve</span>
          </span>
          <span className={cn(ROW_CHIP, OFF_CHIP)} aria-hidden>
            Off
          </span>
        </button>
      )}
      {row.offers.works ? (
        <OffersTile name={place.name} slides={row.offers.slides} open={openSlide} />
      ) : (
        <button
          type="button"
          {...(row.offers.loading ? inertButtonProps(false) : { onClick: () => setOffOpen("offers"), "aria-haspopup": "dialog" as const })}
          aria-label={row.offers.loading ? "Offers, loading" : "Offers, Off"}
          className={cn(PROFILE_MESITA_TILE_BOX_CLASS, ROW_TILE)}
        >
          <span className={ROW_LEAD}>
            <Tag className={MESITA_TILE_ICON} strokeWidth={2.25} />
            <span className="sr-only">Offers</span>
          </span>
          <span className={cn(ROW_CHIP, OFF_CHIP)} aria-hidden>
            {row.offers.loading ? "…" : "Off"}
          </span>
        </button>
      )}
    </div>
    {actions?.reservation ? <ReservationButton r={actions.reservation} /> : null}
    </div>
  );
}

/** The clock the Reserve box reads, in ten-minute steps: the server render
 *  and the first client render read null (no times), so they match; the
 *  times appear once the page runs, and move on as the hour passes. */
const TEN_MIN = 600_000;
function subscribeTenMin(listener: () => void) {
  const id = setInterval(listener, TEN_MIN);
  return () => clearInterval(id);
}
function useTenMinuteClock(): number | null {
  return useSyncExternalStore(subscribeTenMin, () => Math.floor(Date.now() / TEN_MIN), () => null);
}

/** THE RESERVE BOX (Pato, 2026-11-16, MESITA-4159: "do the same with
 *  reservations, show ... hours to reserve ... it must be open at that time
 *  and ... a relevant time where people usually reserve"): OpenTable red,
 *  the glyph over "Reserve" at the left, a black box at the right rotating
 *  times worth asking for (lib/reserve-times.ts) on the Offers beat. They
 *  are times to ask for, not free tables: the agent still phones the place. */
function ReserveTile({ place, onReserve }: { place: PlaceDetail; onReserve?: () => void }) {
  const clock = useTenMinuteClock();
  const slides = useMemo<OfferSlide[]>(
    () =>
      clock === null
        ? []
        : reserveTimes(place, clock * TEN_MIN).map((t) => ({
            key: `${t.day}-${t.time}`,
            // Caption over the big time (MESITA-4167): TODAY / 20:30.
            lead: t.day,
            pill: t.time,
            short: "",
            spoken: `${t.day} ${t.time}`,
            section: null,
            tone: "",
          })),
    [clock, place],
  );
  // A time a second, on the row's even ticks; the offer moves on the odd
  // ones, half a second later (MESITA-4170).
  const live = useOfferSlide(slides, ROW_TICK_MS, { every: ROW_TICKS_PER_CHANGE });
  return (
    <button
      type="button"
      {...(onReserve ? { onClick: onReserve, "aria-haspopup": "dialog" as const } : inertButtonProps(false))}
      aria-label={slides.length > 0 ? `Reserve a table: ask for ${slides.map((s) => s.spoken).join(", ")}` : "Reserve a table"}
      className={cn(PROFILE_MESITA_TILE_BOX_CLASS, ROW_TILE)}
    >
      <span className={ROW_LEAD}>
        <CalendarCheck className={MESITA_TILE_ICON} strokeWidth={2.25} />
        <span className="sr-only">Reserve</span>
      </span>
      {slides.length > 0 ? (
        <span className={cn(ROW_CHIP, RESERVE_CHIP)}>
          <OfferTrack slides={slides} index={live.index} previous={live.previous} plain />
        </span>
      ) : null}
    </button>
  );
}

/** THE OFFERS TILE (MESITA-4151): Home's offer button in the row's tile
 *  box. The words move on the shared beat; the box takes the slide's colour.
 *  The slide on screen when the finger lands is the door, and the tile holds
 *  that slide while a finger or keyboard focus is on it. */
function OffersTile({
  name,
  slides,
  open,
}: {
  name: string;
  slides: OfferSlide[];
  open: (slide: OfferSlide) => (() => void) | undefined;
}) {
  const live = useOfferSlide(slides, ROW_TICK_MS, { every: ROW_TICKS_PER_CHANGE, phase: 1 });
  const [held, setHeld] = useState<number | null>(null);
  const index = held ?? live.index;
  const slide = slides[index];
  const run = open(slide);
  const hold = () => setHeld((h) => h ?? live.index);
  const release = () => setHeld(null);
  return (
    <button
      type="button"
      {...(run ? { onClick: run } : inertButtonProps(false))}
      aria-label={offersLabel(name, slides)}
      onPointerDown={hold}
      onFocus={hold}
      onPointerCancel={release}
      onPointerLeave={release}
      onBlur={release}
      className={cn(PROFILE_MESITA_TILE_BOX_CLASS, ROW_TILE)}
      data-tile-bonus
    >
      <span className={ROW_LEAD}>
        <Tag className={MESITA_TILE_ICON} strokeWidth={2.25} />
        <span className="sr-only">Offers</span>
      </span>
      <span className={cn(ROW_CHIP, OFFERS_CHIP)}>
        <OfferTrack slides={slides} index={index} previous={held === null ? live.previous : null} plain />
      </span>
    </button>
  );
}

/** YOUR TABLE HERE (MESITA-3640, Pato: "if there is an active reservation
 *  for that place display it below the 4 buttons as one large button"; two
 *  buttons since MESITA-4151): a
 *  guest holds at most one live reservation per place. Full width under the
 *  row, the tiles' height and shape, green once the place confirmed, grey
 *  while it is booking; opens the reservation. */
function ReservationButton({ r }: { r: NonNullable<PlaceActions["reservation"]> }) {
  return (
    <button
      type="button"
      onClick={r.onOpen}
      data-profile-actions="reservation"
      aria-label={`Your reservation here, ${r.when}, ${r.status}`}
      className={cn(
        "flex h-13 w-full min-w-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition hover:opacity-90 active:scale-[0.99]",
        MONEY_TONE[r.confirmed ? "green" : "off"],
      )}
    >
      <CalendarCheck className={MESITA_TILE_ICON} strokeWidth={2.25} />
      <span className="truncate">Your reservation · {r.when}</span>
      <span
        className={cn(PLACE_PILL_CLASS, "ml-auto shrink-0", r.confirmed ? "bg-foreground text-paper" : "bg-paper text-muted-foreground")}
      >
        {r.status}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

/** The sticky block the Mesita row and the tab strip share: white, full
 *  width (the body's 16px sides undone), above the boxes (MESITA-3330).
 *  mb-1: 12 (the column's gap-3) + 4 = 16px under the strip's hairline on
 *  every tab at rest, the same as the 16px sides (MESITA-3379; Overview had
 *  12, Rewards 16, Reviews 32). The margin is not painted: pinned, content
 *  meets the hairline as under any sticky header. */
export const PLACE_STICKY_BLOCK_CLASS = "bg-card sticky top-0 z-20 -mx-4 mb-1 flex flex-col";
/** The Mesita row inside it: 16px sides, 16px under, a hairline, then the
 *  strip (8px over for the corner badges from MESITA-3421 to MESITA-3424). */
export const PLACE_STICKY_ROW_CLASS = "border-border border-b px-4 pb-4";

/** A Mesita tile's glyph: the grey tiles' 18px. */
const MESITA_TILE_ICON = "h-[18px] w-[18px] shrink-0";
