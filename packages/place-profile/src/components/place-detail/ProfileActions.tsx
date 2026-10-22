"use client";

import {
  CalendarCheck,
  Heart,
  Route,
  Phone,
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

// TWO ROWS (Pato, MESITA-2633: "five buttons in one row will look bad, so
// just use two rows"):
//
//   [ ♡ Like ] [ ➤ Directions ] [ ✆ Contact ] [ ⇪ Share ]
//   [ ▣ Reserve with Mesita                             ]
//
// ROW 1 is four equal grey tiles, icon over a 12px label. Like is the heart
// (MESITA-2521's favorite, named the way Social names it: "liked"); it fills
// red once hearted. Directions opens Google Maps already routing to the
// place (MESITA-2619). Share is back here; the top bar's dots still share.
//
// ROW 2 is ONE ink button, "Reserve with Mesita", full width. NO TIMES ON
// THE PROFILE (Pato, MESITA-2633: "I would leave a single button, Reserve
// with Mesita. I wouldn't show fixed hours on the profile because they can be
// confused with confirmed availability"): the guest picks day, party and a
// preferred time in the sheet, then the agent calls and confirms. A sliding
// row of OpenTable-style times lived for one push and never shipped.
//
// No Pay (MESITA-2618), no "I went" (MESITA-2567), no pinned bar. Every
// button is 44px or more (MESITA-2324). A missing callback leaves its button
// visible and inert, so the rows never change shape; a place that turned
// bookings off has an inert Reserve.

const tileBtn =
  "bg-muted text-foreground hover:bg-muted/70 flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold transition active:scale-[0.99]";

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
          label={saved ? "Liked" : "Like"}
          live={Boolean(onSave)}
          onClick={onSave}
          pressed={saved}
          ariaLabel={saved ? "Remove from favorites" : "Add to favorites"}
          className={cn(
            saved &&
              "shadow-danger bg-destructive hover:bg-destructive text-white",
          )}
          iconClassName={cn(saved && "fill-current")}
        />
        <ActionTile
          // A route between two points (Pato, MESITA-2635: "other icon for
          // directions"); the paper-plane arrow read as send / my location.
          Icon={Route}
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

      <button
        type="button"
        {...(reserveLive
          ? { onClick: onReserve, "aria-haspopup": "dialog" as const }
          : inertButtonProps(false))}
        aria-label="Reserve a table"
        className={cn(
          PLACE_BUTTON_CLASS,
          "bg-foreground text-paper w-full text-sm hover:opacity-90",
        )}
        data-profile-actions="reserve"
      >
        <CalendarCheck className={PLACE_BUTTON_ICON_CLASS} strokeWidth={2.25} />
        Reserve with Mesita
      </button>
    </div>
  );
}
