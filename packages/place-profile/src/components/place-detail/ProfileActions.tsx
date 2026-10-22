"use client";

import {
  CalendarCheck,
  Heart,
  Map as MapIcon,
  Phone,
  QrCode,
  Share2,
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

// TWO ROWS (Pato, MESITA-2688: "Mesita Reserve" and "Mesita Pay" beside
// the four tiles; MESITA-2689 made them the ink button, halved):
//
//   [ ♡ Save ] [ ▱ Directions ] [ ✆ Contact ] [ ⇪ Share ]
//   [ ▣ Mesita Reserve       ] [ ▦ Mesita Pay  Soon    ]
//
// ROW 1 is four equal grey tiles, icon over a 12px label. Save is the heart
// (MESITA-2521's favorite); once saved only the heart turns red, never the
// tile (MESITA-2635). Directions opens Google Maps already routing to the
// place (MESITA-2619). Share is back here; the top bar's dots report.
//
// ROW 2 is the old Reserve with Mesita button cut in half (Pato, MESITA-2689:
// "kinda like this button but half and half, but same height and colour"):
// two 44px ink buttons, icon beside the label, "Mesita Reserve" then
// "Mesita Pay", dropping "Mesita " when the row is narrow ("only if enough
// space"). MESITA-2688 had made them grey tiles. NO TIMES ON THE PROFILE
// (Pato, MESITA-2633: fixed hours "can be confused with
// confirmed availability"): the guest picks day, party and a preferred time
// in the sheet, then the agent calls and confirms. Pay is Soon ("pay is as
// soon but leave it there for the moment"): inert, wearing the consumer
// bar's grey Soon tag and its QR glyph. MESITA-2618 had taken Pay off.
//
// No "I went" (MESITA-2567), no pinned bar. Every button is 44px or more
// (MESITA-2324). A missing callback leaves its button visible and inert, so
// the rows never change shape; a place that turned bookings off has an inert
// Reserve.

// THE TILES ARE ONE STEP DARKER THAN --fill (Pato, MESITA-2647: "make the
// four gray buttons a bit darker, just a bit, minimum"): the border grey at
// 60% over the white band ≈ #e9e9e9 (bg-muted is #efefef); hover 80%.
// Row 2 is the old Reserve with Mesita button, cut in two (MESITA-2689).
const inkButton = cn(
  PLACE_BUTTON_CLASS,
  "bg-foreground text-paper w-full text-sm hover:opacity-90",
);
const tileBtn =
  "bg-border/60 text-foreground hover:bg-border/80 flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold transition active:scale-[0.99]";

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
  const reserveLive = isReserveActionEnabled(place) && Boolean(onReserve);
  const directionsUrl = buildDirectionsUrl(place);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-4 gap-2" data-profile-actions="tiles">
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

      {/* @container: the "Mesita " prefix shows only when the row is 20rem
          or wider (Pato: "only if enough space"), measured on the row, not
          the viewport, so admin's phone frame reads the same. */}
      <div
        className="@container grid grid-cols-2 gap-2"
        data-profile-actions="mesita"
      >
        <button
          type="button"
          {...(reserveLive
            ? { onClick: onReserve, "aria-haspopup": "dialog" as const }
            : inertButtonProps(false))}
          aria-label="Reserve a table"
          className={inkButton}
        >
          <CalendarCheck className={PLACE_BUTTON_ICON_CLASS} strokeWidth={2.25} />
          <span className="truncate">
            <span className="hidden @xs:inline">Mesita </span>Reserve
          </span>
        </button>
        <button
          type="button"
          {...inertButtonProps(false)}
          aria-label="Pay, Soon"
          className={inkButton}
        >
          <QrCode className={PLACE_BUTTON_ICON_CLASS} strokeWidth={2.25} />
          <span className="truncate">
            <span className="hidden @xs:inline">Mesita </span>Pay
          </span>
          {/* The bar's Soon tag (BottomNav, MESITA-2079): a quiet chip,
              white on the ink. */}
          <span className="bg-card text-muted-foreground flex h-4 shrink-0 items-center rounded-full px-1.5 text-[10px] leading-none font-semibold">
            Soon
          </span>
        </button>
      </div>
    </div>
  );
}
