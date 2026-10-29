"use client";

import {
  CalendarCheck,
  Heart,
  Map as MapIcon,
  Phone,
  QrCode,
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
import { PLACE_BUTTON_CLASS, PLACE_BUTTON_ICON_CLASS } from "../../lib/ui";

// THREE ROWS (Pato, MESITA-2690: "include extra button / save directions
// contact share / reserve / prepay pay"; MESITA-2688/2689 had Reserve and
// Pay side by side):
//
//   [ ♡ Save ] [ ▱ Directions ] [ ✆ Contact ] [ ⇪ Share ]
//   [ ▣ Mesita Reserve                                  ]
//   [ ▤ Mesita Prepay  Soon  ] [ ▦ Mesita Pay  Soon     ]
//
// ROW 1 is four equal grey tiles, icon over a 12px label. Save is the heart
// (MESITA-2521's favorite); once saved only the heart turns red, never the
// tile (MESITA-2635). Directions opens Google Maps already routing to the
// place (MESITA-2619). Share is back here; the top bar's dots report.
//
// ROWS 2 AND 3 are the ink button (Pato, MESITA-2689: "kinda like this
// button but half and half, but same height and colour"): 44px, icon beside
// the label, 8px apart every way. Row 2 is Mesita Reserve alone, full width.
// Row 3 is Mesita Prepay then Mesita Pay, halved; each drops "Mesita " when
// the row is too narrow for "Mesita Prepay" and its Soon chip ("only if
// enough space"). NO TIMES ON THE PROFILE (Pato, MESITA-2633: fixed hours
// "can be confused with confirmed availability"): the guest picks day,
// party and a preferred time in the sheet, then the agent calls and
// confirms. Pay is Soon ("pay is as soon but leave it there for the
// moment"), and so is Prepay (decision: nothing behind it is built):
// inert, each wearing the consumer bar's grey Soon tag. MESITA-2618 had
// taken Pay off.
//
// No "I went" (MESITA-2567), no pinned bar. Every button is 44px or more
// (MESITA-2324). A missing callback leaves its button visible and inert, so
// admin's preview keeps the consumer's shape. A PLACE THAT TAKES NO
// RESERVATIONS HAS NO RESERVE (Pato, MESITA-3076: "if not reservations, then
// kill that"): an inert ink button read exactly like a live one, so the row
// is gone and Prepay · Pay sits under the tiles.

// THE TILES ARE ONE STEP DARKER THAN --fill (Pato, MESITA-2647: "make the
// four gray buttons a bit darker, just a bit, minimum"): the border grey at
// 60% over the white band ≈ #e9e9e9 (bg-muted is #efefef); hover 80%.
// Rows 2 and 3 are the old Reserve with Mesita button (MESITA-2689).
const inkButton = cn(
  PLACE_BUTTON_CLASS,
  "bg-foreground text-paper w-full text-sm hover:opacity-90",
);

// THE ROWS' LAYOUT AND A TILE'S BOX ARE WRITTEN ONCE (Pato, MESITA-2701:
// "the placeholders must be similar to the page you are loading, like the
// sizes"): read here and by ProfileSummarySkeleton, which lays its bones
// out in them. The ink rows are PLACE_BUTTON_CLASS's 44px.

/** The three rows: tiles, 8px, then the two Mesita rows. ONE GAP EVERY WAY
 *  (Pato, MESITA-2823: "fix spacing here"): the 12px under the tiles was the
 *  only step that was not the tiles' and the halves' 8px. */
export const PROFILE_ACTIONS_CLASS = "flex flex-col gap-2";
/** Row 1: four equal tiles, 8px apart. */
export const PROFILE_TILES_ROW_CLASS = "grid grid-cols-4 gap-2";
/** A tile's box: 56px, rounded-lg, icon over label. */
export const PROFILE_TILE_BOX_CLASS =
  "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1";
/** Rows 2 and 3, 8px apart. */
export const PROFILE_MESITA_ROWS_CLASS = "flex flex-col gap-2";
/** Row 3: Prepay and Pay, halved. */
export const PROFILE_HALVES_ROW_CLASS = "grid grid-cols-2 gap-2";

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
          label="Directions"
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
      </div>

      <div className={PROFILE_MESITA_ROWS_CLASS} data-profile-actions="mesita">
        {takesReservations && (
          <button
            type="button"
            {...(reserveLive
              ? { onClick: onReserve, "aria-haspopup": "dialog" as const }
              : inertButtonProps(false))}
            aria-label="Reserve a table"
            className={inkButton}
          >
            <CalendarCheck className={PLACE_BUTTON_ICON_CLASS} strokeWidth={2.25} />
            <span className="truncate">Mesita Reserve</span>
          </button>
        )}
        {/* @container: "Mesita " shows on both halves only when the row is
            wide enough for "Mesita Prepay" and its Soon chip (Pato: "only if
            enough space"): measured in Inter at 380px, so @sm (24rem). A
            phone's row is ~326px, so it reads "Prepay · Pay" there. Measured
            on the row, not the viewport, so admin's phone frame reads the
            same. */}
        <div className={cn("@container", PROFILE_HALVES_ROW_CLASS)}>
          <SoonInkButton Icon={Wallet} label="Prepay" />
          <SoonInkButton Icon={QrCode} label="Pay" />
        </div>
      </div>
    </div>
  );
}

/** A Mesita money button that is not built yet: inert, the ink button with
 *  the bar's Soon tag (BottomNav, MESITA-2079), a quiet chip white on the
 *  ink. */
function SoonInkButton({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      {...inertButtonProps(false)}
      aria-label={`${label}, Soon`}
      className={inkButton}
    >
      <Icon className={PLACE_BUTTON_ICON_CLASS} strokeWidth={2.25} />
      <span className="truncate">
        <span className="hidden @sm:inline">Mesita </span>
        {label}
      </span>
      <span className="bg-card text-muted-foreground flex h-4 shrink-0 items-center rounded-full px-1.5 text-[10px] leading-none font-semibold">
        Soon
      </span>
    </button>
  );
}
