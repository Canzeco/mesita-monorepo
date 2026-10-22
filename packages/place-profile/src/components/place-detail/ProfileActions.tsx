"use client";

import { CalendarCheck, Heart, Navigation, Phone } from "lucide-react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";
import { buildDirectionsUrl } from "../../lib/maps-link";
import { isReserveActionEnabled } from "../../lib/place-profile-actions";
import { PLACE_BUTTON_CLASS, PLACE_BUTTON_ICON_CLASS } from "../../lib/ui";

// ONE ROW (Pato, MESITA-2618: "i don't like the six buttons there. it looks
// like shit"): Reserve, the one dark button, and Directions share the
// width; Favorite and Contact are 44px grey icon squares beside them.
//
// DIRECTIONS LEADS WITH MAPS (Pato, MESITA-2619: "add button for location
// for maps, like google maps. super important"): it opens Google Maps
// already routing to the place (lib/maps-link.ts), through the consumer's
// onOpenLink like every outbound link; the admin phone keeps it inert.
// Share left this row for the three dots in the top bar (PlaceProfile).
//
// decision: Pay (Soon) is gone from the place screen (MESITA-2618). It
// opened nothing, and the bar already says Pay · Soon (MESITA-2076). There
// is no "I went" (Pato, MESITA-2567). No pinned bottom bar. 44px tall (the
// touch-target minimum, MESITA-2324). Live behavior (bookmark, contact
// sheet, reservation sheet) stays in the consumer and arrives as
// callbacks; a missing callback leaves its button visible and inert, so
// the row never changes shape.
const btn =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-lg transition active:scale-[0.99]";
// Reserve and Directions are the screen's one labelled button
// (PLACE_BUTTON_CLASS, MESITA-2623), the same size as Location's and Links'.
const wideBtn = cn(PLACE_BUTTON_CLASS, "flex-1 px-2");
const iconBtn = cn(btn, "w-11 bg-muted text-foreground hover:bg-muted/70");

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
  const onOpenLink = actions?.onOpenLink;
  const onReserve = actions?.onReserve;
  const reserveLive = isReserveActionEnabled(place) && Boolean(onReserve);
  const directionsUrl = buildDirectionsUrl(place);

  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        {...(reserveLive
          ? { onClick: onReserve, "aria-haspopup": "dialog" as const }
          : inertButtonProps(false))}
        aria-label="Reserve a table"
        className={cn(wideBtn, "bg-foreground text-paper hover:opacity-90")}
      >
        <CalendarCheck className={PLACE_BUTTON_ICON_CLASS} strokeWidth={2.25} />
        Reserve
      </button>
      <button
        type="button"
        {...(onOpenLink
          ? { onClick: () => onOpenLink(directionsUrl) }
          : inertButtonProps(false))}
        aria-label="Directions in Google Maps"
        data-directions-url={directionsUrl}
        className={cn(wideBtn, "bg-muted text-foreground hover:bg-muted/70")}
      >
        <Navigation className={PLACE_BUTTON_ICON_CLASS} strokeWidth={2.25} />
        Directions
      </button>
      <button
        type="button"
        {...(onSave
          ? { onClick: onSave, "aria-pressed": saved }
          : inertButtonProps(false))}
        aria-label={saved ? "Remove from favorites" : "Add to favorites"}
        className={cn(
          iconBtn,
          saved &&
            "shadow-danger bg-destructive text-white hover:bg-destructive",
        )}
      >
        <Heart
          className={cn("h-[18px] w-[18px]", saved && "fill-current")}
          strokeWidth={2.25}
        />
      </button>
      <button
        type="button"
        {...(onContact
          ? { onClick: onContact, "aria-haspopup": "dialog" as const }
          : inertButtonProps(false))}
        aria-label="Contact"
        className={iconBtn}
      >
        {hasWhatsApp ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/channels/whatsapp.svg"
            alt=""
            aria-hidden
            className="h-[18px] w-[18px]"
          />
        ) : (
          <Phone className="h-[18px] w-[18px]" strokeWidth={2.25} />
        )}
      </button>
    </div>
  );
}
