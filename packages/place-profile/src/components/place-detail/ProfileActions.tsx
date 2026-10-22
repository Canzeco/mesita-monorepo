"use client";

import { CalendarCheck, Heart, Phone, Share2 } from "lucide-react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";
import { isReserveActionEnabled } from "../../lib/place-profile-actions";

// ONE ROW (Pato, MESITA-2618: "i don't like the six buttons there. it looks
// like shit"): Reserve, the one dark button, takes the width; Favorite,
// Contact and Share are 44px grey icon squares beside it, the way Maps puts
// Save and Share next to Directions. Until MESITA-2618 this was two rows,
// Favorite · Contact · Share over Reserve · Pay (Soon) (MESITA-2321).
//
// decision: Pay (Soon) is gone from the place screen. It opened nothing, and
// the bar already says Pay · Soon (MESITA-2076); a Soon button here was a
// dead door. There is no "I went" (Pato, MESITA-2567). No pinned bottom bar.
// 44px tall (the touch-target minimum, MESITA-2324). Live behavior
// (bookmark, contact sheet, share sheet, reservation sheet) stays in the
// consumer and arrives as callbacks; a missing callback leaves its button
// visible and inert, so the row never changes shape.
const btn =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-lg transition active:scale-[0.99]";
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
  const onShare = actions?.onShare;
  const onReserve = actions?.onReserve;
  const reserveLive = isReserveActionEnabled(place) && Boolean(onReserve);

  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        {...(reserveLive
          ? { onClick: onReserve, "aria-haspopup": "dialog" as const }
          : inertButtonProps(false))}
        aria-label="Reserve a table"
        className={cn(
          btn,
          "bg-foreground text-paper type-label min-w-0 flex-1 gap-1.5 px-2 font-semibold whitespace-nowrap hover:opacity-90",
        )}
      >
        <CalendarCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
        Reserve
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
      <button
        type="button"
        {...(onShare ? { onClick: onShare } : inertButtonProps(false))}
        aria-label="Share"
        className={iconBtn}
      >
        <Share2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </button>
    </div>
  );
}
