"use client";

import {
  CalendarCheck,
  Heart,
  Map as MapIcon,
  Phone,
  QrCode,
  Rocket,
  Share2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type React from "react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";
import { buildDirectionsUrl } from "../../lib/maps-link";
import { isReserveActionEnabled } from "../../lib/place-profile-actions";


// TWO ROWS OF TILES (Pato, MESITA-3315: "make those 3 buttons the same
// height of the other 5 buttons, but wider because are three instead of 5.
// and keep the dark colors"; MESITA-3314 had them as one row of 44px
// buttons, "the three buttons instead of lines buttons, in one line:
// Reserve, Prepay, Pay"; MESITA-2690 had three rows, Mesita Reserve full
// width over Mesita Prepay and Mesita Pay halved; MESITA-2688/2689 had
// Reserve and Pay side by side):
//
//   [ ♡ Save ] [ ▱ Maps ] [ ✆ Contact ] [ ⇪ Share ] [ ⇧ Upgrade ]
//   [   ▣   ] [ ▤ Prepay          ] [ ▦ Pay             ]
//   [Reserve] [   30% Bonus       ] [   5% Back         ]
//
// ROW 1 is five equal grey tiles, icon over a 12px label. Save is the heart
// (MESITA-2521's favorite); once saved only the heart turns red, never the
// tile (MESITA-2635). Maps opens Google Maps already routing to the place
// (MESITA-2619); it read Directions until the fifth tile left no room for
// the word (MESITA-3200). Share is back here; the top bar's dots report.
// UPGRADE (Pato, MESITA-3200: "I don't like boost being hidden there below";
// MESITA-3201: "Upgrade just opens a modal on top, like contact") opens the
// host's sheet, never Checkout, on every place: a Google-only one gets that
// sheet's not-open-yet screen, so the row never changes width.
//
// ROW 2 is Reserve in the INK and the money tiles in LINK GREEN (Pato,
// MESITA-3353: "reserve with dark button"; "use the green color of Link to
// psychologically give trust: green background, black text"): green-400
// under near-black words, Stripe Link's pay button; all three emerald for
// an hour, MESITA-3348, and the ink from MESITA-3315 before that), the grey
// tiles' height (56px), the
// glyph at the left of a 12px label (MESITA-3335; it sat over the label
// until then), 8px apart (Pato, MESITA-2689: "same height and
// colour"), three equal widths, the labels without "Mesita ". PREPAY AND
// PAY SAY THE AMOUNT under the label, always, blocked or not (Pato,
// MESITA-3324: "Prepay, Up to 25% OFF / Pay, 5% Cashback ... BUT ALWAYS
// MENTION THE AMOUNT"): his fixed sentences (MESITA-3313; cashback is the
// standard 5%, MESITA-3299), never a number computed here. No chip
// on any of them (MESITA-3317, Pato: "remove the stupid walk-in icon. just
// put the button blocked if it doesn't work"): a blocked tile is the same
// dark tile, disabled, and only the screen reader hears why. NO TIMES ON
// THE PROFILE
// (Pato, MESITA-2633: fixed hours "can be confused with confirmed
// availability"): the guest picks day, party and a preferred time in the
// sheet, then the agent calls and confirms. Pay waits for W2b (MESITA-3305)
// and Prepay for its own wave: since W1b (MESITA-3303) buying a voucher
// lives on the Vouchers tab, and W1b had taken the Prepay button off, but
// Pato's row names it (MESITA-3314), so it stays. Both are inert and wear
// NO Soon chip (Pato, MESITA-3315: "remove the soon btw"; the consumer
// bar's grey Soon tag sat on them from MESITA-2690). MESITA-2618 had taken
// Pay off.
//
// No "I went" (MESITA-2567), no pinned bar. Every button is 44px or more
// (MESITA-2324). A missing callback leaves its button visible and inert, so
// admin's preview keeps the consumer's shape. A PLACE THAT TAKES NO
// RESERVATIONS HAS A DISABLED RESERVE, NEVER A MISSING ONE (Pato, MESITA-3078:
// "must be disabled, but never fucking disapearing"; MESITA-3076 had hidden
// it). BLOCKED IS DARK (Pato, MESITA-3081: "reservations must be blocked
// dark", "same for mesita prepay and mesita pay"): every blocked Mesita
// button is the ink button, `disabled`, no hover, no press. Reserve varies by
// place ("reserve can vary depending on the place"): live where it takes
// bookings, blocked where it doesn't (its Walk-in chip left with
// MESITA-3317). Prepay and Pay are both blocked, with no chip: the free-amount prepay left with the discount
// product (MESITA-3299), vouchers sell on their tab (MESITA-3303) and paying
// arrives with W2b (MESITA-3305).

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
/** Row 1: five equal tiles, 8px apart. */
export const PROFILE_TILES_ROW_CLASS = "grid grid-cols-5 gap-2";
/** A tile's box: 56px, rounded-lg, icon over label. */
export const PROFILE_TILE_BOX_CLASS =
  "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1";
/** Row 2: Reserve · Prepay · Pay on the grey tiles' five columns, 8px
 *  apart (Pato, MESITA-3339: "reserve button is not as large, this way:
 *  Save Maps Contact Share Upgrade / Reserve Prepay Prepay Pay Pay"):
 *  Reserve takes the first column, Prepay and Pay two each. Three equal
 *  tiles from MESITA-3314 until then. */
export const PROFILE_MESITA_ROW_CLASS = "grid grid-cols-5 gap-2";
/** A wide Mesita tile's box: two columns, the grey tiles' 56px, a 20px
 *  glyph at the left and the words at its right, the 14px label over the
 *  12px amount line (MESITA-3339; the glyph went left in MESITA-3335). */
export const PROFILE_MESITA_TILE_BOX_CLASS =
  "col-span-2 flex h-14 min-w-0 flex-row items-center justify-center gap-2 rounded-lg px-1.5";

// Reserve is the grey tile's own box in the ink (MESITA-3353): one column,
// the glyph over a 12px label.
const inkReserve = cn(
  PROFILE_TILE_BOX_CLASS,
  "bg-foreground text-paper text-xs font-semibold transition hover:opacity-90 active:scale-[0.99]",
);
// A blocked Reserve: still the ink, but `disabled`: no hover, no press,
// the not-allowed cursor (MESITA-3081).
const blockedInkReserve = cn(
  PROFILE_TILE_BOX_CLASS,
  "bg-foreground text-paper cursor-not-allowed text-xs font-semibold",
);
// A blocked wide Mesita tile (Prepay, Pay): Link green, `disabled`, 14px.
const blockedInkTile = cn(
  PROFILE_MESITA_TILE_BOX_CLASS,
  "bg-green-400 text-neutral-950 cursor-not-allowed text-sm font-semibold",
);

const tileBtn = cn(
  PROFILE_TILE_BOX_CLASS,
  "bg-border/60 text-foreground hover:bg-border/80 text-xs font-semibold transition active:scale-[0.99]",
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
      className={cn(tileBtn, className)}
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
 *  scrollable, those stuck at the top"): Reserve · Prepay · Pay leave the
 *  summary band and ride in PlaceDetailBody's sticky block with the tab
 *  strip, so they stay reachable while the body scrolls; the grey tiles
 *  scroll away with the summary. Same tiles, same wiring. */
export function MesitaActions({
  place,
  actions,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
}) {
  const onReserve = actions?.onReserve;
  const takesReservations = isReserveActionEnabled(place);
  const reserveLive = takesReservations && Boolean(onReserve);
  return (
    <>
    <div className={PROFILE_MESITA_ROW_CLASS} data-profile-actions="mesita">
        <button
          type="button"
          {...(reserveLive
            ? { onClick: onReserve, "aria-haspopup": "dialog" as const }
            : inertButtonProps(false))}
          disabled={!takesReservations}
          aria-label={
            takesReservations
              ? "Reserve a table"
              : "Reserve a table, not available at this place"
          }
          className={takesReservations ? inkReserve : blockedInkReserve}
        >
          <CalendarCheck className={RESERVE_ICON} strokeWidth={2.25} />
          <span className="max-w-full truncate">Reserve</span>
        </button>
        <InertInkTile Icon={Wallet} label="Prepay" amount="30% Bonus" />
        <InertInkTile Icon={QrCode} label="Pay" amount="5% Back" />
      </div>
    </>
  );
}

/** The sticky block the Mesita row and the tab strip share: white, full
 *  width (the body's 16px sides undone), above the boxes (MESITA-3330). */
export const PLACE_STICKY_BLOCK_CLASS = "bg-card sticky top-0 z-20 -mx-4 flex flex-col";
/** The Mesita row inside it: 16px sides, 16px under, a hairline, then the
 *  strip. */
export const PLACE_STICKY_ROW_CLASS = "border-border border-b px-4 pb-4";

/** Reserve's glyph: the grey tiles' 18px. */
const RESERVE_ICON = "h-[18px] w-[18px] shrink-0";
/** A wide tile's glyph: 20px beside two lines (MESITA-3339). */
const MESITA_TILE_ICON = "h-5 w-5 shrink-0";

/** A Mesita money tile that is not built yet: the blocked ink tile, no chip
 *  (Pato, MESITA-3315: "remove the soon"); the screen reader still hears it.
 *  `amount` is the second line, always shown (MESITA-3324): "30% Bonus" (Pato,
 *  MESITA-3349: "don't mention up to 30% bonus, just 30% Bonus"; "Up to"
 *  for an hour, MESITA-3345) and
 *  "5% Back" (Pato, MESITA-3339: "its clearer, instead of OFF"; "Up to 25%
 *  OFF" and "5% Cashback" until then). */
function InertInkTile({ Icon, label, amount }: { Icon: LucideIcon; label: string; amount: string }) {
  return (
    <button
      type="button"
      {...inertButtonProps(false)}
      disabled
      aria-label={`${label}, ${amount}, Soon`}
      className={blockedInkTile}
    >
      <Icon className={MESITA_TILE_ICON} strokeWidth={2.25} />
      <span className="flex min-w-0 flex-col items-start gap-1 text-left">
        <span className="max-w-full truncate leading-none">{label}</span>
        {/* The amount weighs the same as the label (Pato, MESITA-3356: "bonus
            and back must be as thin/gross as the top text, maybe even size"),
            one weight like Link's button; 12px medium at 70% until then. */}
        <span className="max-w-full truncate leading-none">{amount}</span>
      </span>
    </button>
  );
}
