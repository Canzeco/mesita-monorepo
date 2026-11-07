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
//   [ ▣ Reserve         ] [ ▤ Prepay          ] [ ▦ Pay             ]
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
// ROW 2 is three ink tiles, the grey tiles' box (56px, icon over a 12px
// label, 8px apart) in the ink (Pato, MESITA-2689: "same height and
// colour"), three equal widths, the labels without "Mesita ". The chip that
// says why a tile is blocked sits beside the icon. NO TIMES ON THE PROFILE
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
// bookings, blocked with a Walk-in chip where it doesn't. Prepay and Pay are
// both blocked, with no chip: the free-amount prepay left with the discount
// product (MESITA-3299), vouchers sell on their tab (MESITA-3303) and paying
// arrives with W2b (MESITA-3305).

// THE TILES ARE ONE STEP DARKER THAN --fill (Pato, MESITA-2647: "make the
// four gray buttons a bit darker, just a bit, minimum"): the border grey at
// 60% over the white band ≈ #e9e9e9 (bg-muted is #efefef); hover 80%.
// THE ROWS' LAYOUT AND A TILE'S BOX ARE WRITTEN ONCE (Pato, MESITA-2701:
// "the placeholders must be similar to the page you are loading, like the
// sizes"): read here and by ProfileSummarySkeleton, which lays its bones
// out in them. The ink row is the tiles' 56px.

/** The two rows: tiles, 8px, then the Mesita row. ONE GAP EVERY WAY (Pato,
 *  MESITA-2823: "fix spacing here"): the 12px under the tiles was the only
 *  step that was not the tiles' and the buttons' 8px. */
export const PROFILE_ACTIONS_CLASS = "flex flex-col gap-2";
/** Row 1: five equal tiles, 8px apart. */
export const PROFILE_TILES_ROW_CLASS = "grid grid-cols-5 gap-2";
/** A tile's box: 56px, rounded-lg, icon over label. */
export const PROFILE_TILE_BOX_CLASS =
  "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1";
/** Row 2: Reserve · Prepay · Pay, three equal tiles, 8px apart
 *  (MESITA-3314, MESITA-3315). */
export const PROFILE_MESITA_ROW_CLASS = "grid grid-cols-3 gap-2";

// Row 2 is the grey tile's box in the ink (MESITA-3315), three across.
const inkTile = cn(
  PROFILE_TILE_BOX_CLASS,
  "bg-foreground text-paper text-xs font-semibold transition hover:opacity-90 active:scale-[0.99]",
);
// A blocked Mesita tile: still the ink, but `disabled`: no hover, no press,
// the not-allowed cursor (MESITA-3081).
const blockedInkTile = cn(
  PROFILE_TILE_BOX_CLASS,
  "bg-foreground text-paper cursor-not-allowed text-xs font-semibold",
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
  const onReserve = actions?.onReserve;
  const onBoost = actions?.onBoost;
  const takesReservations = isReserveActionEnabled(place);
  const reserveLive = takesReservations && Boolean(onReserve);
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
          className={takesReservations ? inkTile : blockedInkTile}
        >
          <span className="flex shrink-0 items-center gap-1.5">
            <CalendarCheck className={MESITA_TILE_ICON} strokeWidth={2.25} />
            {!takesReservations && <BlockedChip>Walk-in</BlockedChip>}
          </span>
          <span className="max-w-full truncate">Reserve</span>
        </button>
        <InertInkTile Icon={Wallet} label="Prepay" />
        <InertInkTile Icon={QrCode} label="Pay" />
      </div>
    </div>
  );
}

/** The glyph on an ink tile: the grey tiles' 18px. */
const MESITA_TILE_ICON = "h-[18px] w-[18px] shrink-0";

/** A Mesita money tile that is not built yet: the blocked ink tile, no chip
 *  (Pato, MESITA-3315: "remove the soon"); the screen reader still hears it. */
function InertInkTile({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      {...inertButtonProps(false)}
      disabled
      aria-label={`${label}, Soon`}
      className={blockedInkTile}
    >
      <Icon className={MESITA_TILE_ICON} strokeWidth={2.25} />
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

/** Why a blocked ink button is blocked: a quiet chip white on the ink. */
function BlockedChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-card text-muted-foreground flex h-4 shrink-0 items-center rounded-full px-1.5 text-[10px] leading-none font-semibold">
      {children}
    </span>
  );
}
