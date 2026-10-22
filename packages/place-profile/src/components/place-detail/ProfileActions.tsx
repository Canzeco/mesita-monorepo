"use client";

import {
  CalendarCheck,
  Heart,
  Navigation,
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

// TWO ROWS (Pato, MESITA-2633: "now the buttons must be two rows: liked,
// directions, contact, share. reservations in one row with next hours, just
// like OpenTable"):
//
//   [ ♡ Like ] [ ➤ Directions ] [ ✆ Contact ] [ ⇪ Share ]
//   Reserve · Today
//   [ ▣ Reserve ] [19:00] [19:30] [20:00] [20:30] …  ← slides sideways
//
// ROW 1 is four equal grey buttons, icon over a 12px label. Like is the
// heart (MESITA-2521's favorite, named the way Social names it: "liked");
// it fills red once hearted. Directions opens Google Maps already routing to
// the place (MESITA-2619). Share is back here; the top bar's dots still share.
//
// ROW 2 is reservations the OpenTable way: the ink Reserve button, then the
// next times on one day as a sliding row. A time is a REQUEST, not a
// confirmed table (Mesita books by calling); tapping one opens the sheet
// already on that date and time, tapping Reserve opens it on its own
// default. The times are the consumer's (`reserveSlots`, from its slot
// rules and the place's hours); the admin phone passes none and shows
// Reserve alone. A place that turned bookings off has an inert row.
//
// No Pay (MESITA-2618), no "I went" (MESITA-2567), no pinned bar. Every
// button is 44px or more (MESITA-2324). A missing callback leaves its button
// visible and inert, so the rows never change shape.

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
  const slots = reserveLive ? (actions?.reserveSlots ?? []) : [];
  const dayLabel = actions?.reserveDayLabel;
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
          Icon={Navigation}
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

      <div className="flex flex-col gap-2" data-profile-actions="reserve">
        {slots.length > 0 && dayLabel ? (
          <p className="text-muted-foreground text-xs font-medium">
            Reserve · {dayLabel}
          </p>
        ) : null}
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
          <button
            type="button"
            {...(reserveLive
              ? {
                  onClick: () => onReserve?.(),
                  "aria-haspopup": "dialog" as const,
                }
              : inertButtonProps(false))}
            aria-label="Reserve a table"
            className={cn(
              PLACE_BUTTON_CLASS,
              "bg-foreground text-paper shrink-0 px-4 hover:opacity-90",
              slots.length === 0 && "flex-1",
            )}
          >
            <CalendarCheck className={PLACE_BUTTON_ICON_CLASS} strokeWidth={2.25} />
            Reserve
          </button>
          {slots.map((slot) => (
            <button
              key={`${slot.date}T${slot.time}`}
              type="button"
              onClick={() => onReserve?.(slot)}
              aria-haspopup="dialog"
              aria-label={`Request ${slot.time}${dayLabel ? `, ${dayLabel}` : ""}`}
              className={cn(
                PLACE_BUTTON_CLASS,
                "bg-muted text-foreground hover:bg-muted/70 shrink-0 px-4 tabular-nums",
              )}
              data-reserve-slot={slot.time}
            >
              {slot.time}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
