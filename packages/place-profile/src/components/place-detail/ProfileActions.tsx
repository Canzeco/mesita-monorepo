"use client";

import type React from "react";
import { CalendarCheck, CircleCheck, Heart, Navigation, Share2 } from "lucide-react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";
import { isReserveActionEnabled } from "../../lib/place-profile-actions";
import { placeMapsUrl } from "../../lib/maps-url";

// decision: Pato (2026-10-19, MESITA-2441) — OpenTable/Resy actions:
//   · Save · I went · Share · Directions, an icon row under the title
//     ("I went" is Social v1's third event, MESITA-2442);
//   · Reserve, the ONE primary CTA, pinned to the bottom of the scroll.
// Contact and Pay (Soon) are gone; the phone and WhatsApp are in Links.
// Live behavior arrives as callbacks; a missing callback leaves its button
// visible and inert, so the admin preview has the guest's exact shape.

function IconAction({
  label,
  icon,
  pressed,
  onClick,
  ariaLabel,
  pressedClass = "bg-destructive border-destructive text-white",
}: {
  label: string;
  /** How the pressed disc looks: the heart is red, "I went" is ink. */
  pressedClass?: string;
  icon: React.ReactNode;
  pressed?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      {...(onClick
        ? { onClick, ...(pressed != null ? { "aria-pressed": pressed } : {}) }
        : inertButtonProps(false))}
      aria-label={ariaLabel}
      className="group flex min-h-11 min-w-0 flex-1 flex-col items-center gap-1.5 py-1"
    >
      <span
        className={cn(
          "border-border text-foreground flex h-11 w-11 items-center justify-center rounded-full border transition group-active:scale-95",
          pressed && pressedClass,
        )}
      >
        {icon}
      </span>
      <span className="type-label text-foreground font-semibold">{label}</span>
    </button>
  );
}

export function ProfileActions({
  place,
  actions,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
}) {
  const saved = actions?.saved === true;
  const went = actions?.went === true;
  const onOpenLink = actions?.onOpenLink;
  return (
    <div className="flex items-start justify-around gap-2 px-4 pt-4 pb-5">
      <IconAction
        label={saved ? "Saved" : "Save"}
        ariaLabel={saved ? "Remove from saved" : "Save place"}
        pressed={actions?.onSave ? saved : undefined}
        onClick={actions?.onSave}
        icon={
          <Heart
            className={cn("h-5 w-5", saved && "fill-current")}
            strokeWidth={2}
          />
        }
      />
      {/* Only a Mesita place can be "went"; a Google-only one shows no
          inert button (MESITA-2460). */}
      {actions?.onWent ? (
        <IconAction
          label="I went"
          ariaLabel={went ? "Take back I went" : "I went here"}
          pressed={went}
          onClick={actions.onWent}
          pressedClass="bg-foreground border-foreground text-paper"
          icon={<CircleCheck className="h-5 w-5" strokeWidth={2} />}
        />
      ) : null}
      <IconAction
        label="Share"
        onClick={actions?.onShare}
        icon={<Share2 className="h-5 w-5" strokeWidth={2} />}
      />
      <IconAction
        label="Directions"
        ariaLabel="Directions on Google Maps"
        onClick={onOpenLink ? () => onOpenLink(placeMapsUrl(place)) : undefined}
        icon={<Navigation className="h-5 w-5" strokeWidth={2} />}
      />
    </div>
  );
}

/** Reserve, pinned to the bottom of whichever scroller holds the body
 *  (sticky, so the consumer page, the slide-over and the admin phone all
 *  get it without wiring). A place that opted out of bookings has none. */
export function ReserveBar({
  place,
  actions,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
}) {
  if (!isReserveActionEnabled(place)) return null;
  const onReserve = actions?.onReserve;
  return (
    <div className="bg-card border-border sticky bottom-0 z-20 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        {...(onReserve
          ? { onClick: onReserve, "aria-haspopup": "dialog" as const }
          : inertButtonProps(false))}
        aria-label="Reserve a table"
        className="bg-foreground text-paper type-body inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg font-semibold transition hover:opacity-90 active:scale-[0.99]"
      >
        <CalendarCheck className="h-5 w-5 shrink-0" strokeWidth={2} />
        Reserve
      </button>
    </div>
  );
}
