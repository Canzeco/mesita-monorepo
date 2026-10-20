"use client";

import {
  CalendarCheck,
  CircleCheck,
  Heart,
  Phone,
  QrCode,
  Share2,
} from "lucide-react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";
import { isReserveActionEnabled } from "../../lib/place-profile-actions";

// The profile's five buttons, Instagram-profile style (Pato, MESITA-2321):
//   Save · Contact · Share
//   Reserve · I went · Pay (Soon)
// "I went" is Social v1's third event (MESITA-2442); a Google-only place
// has no onWent and so no button (MESITA-2460), and the row is two wide.
// No pinned bottom bar any more. Gray buttons like Instagram's Follow /
// Message, 44px tall (the touch-target minimum, MESITA-2324); Reserve is the
// one dark button. Live behavior (bookmark, contact
// sheet, share sheet, reservation sheet) stays in the consumer and arrives
// as callbacks; a missing callback leaves its button visible and inert, so
// the rows never change shape.
const btn =
  "inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 type-label font-semibold whitespace-nowrap transition active:scale-[0.99]";
const grayBtn = cn(btn, "bg-muted text-foreground hover:bg-muted/70");

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
  const onWent = actions?.onWent;
  const went = actions?.went === true;
  const onReserve = actions?.onReserve;
  const reserveLive = isReserveActionEnabled(place) && Boolean(onReserve);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          {...(onSave
            ? { onClick: onSave, "aria-pressed": saved }
            : inertButtonProps(false))}
          aria-label={saved ? "Remove from saved" : "Save place"}
          className={cn(
            grayBtn,
            saved &&
              "shadow-danger bg-destructive text-white hover:bg-destructive",
          )}
        >
          <Heart
            className={cn("h-4 w-4 shrink-0", saved && "fill-current")}
            strokeWidth={2.25}
          />
          {saved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          {...(onContact
            ? { onClick: onContact, "aria-haspopup": "dialog" as const }
            : inertButtonProps(false))}
          className={grayBtn}
        >
          {hasWhatsApp ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/channels/whatsapp.svg"
              alt=""
              aria-hidden
              className="h-4 w-4 shrink-0"
            />
          ) : (
            <Phone className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          )}
          Contact
        </button>
        <button
          type="button"
          {...(onShare ? { onClick: onShare } : inertButtonProps(false))}
          className={grayBtn}
        >
          <Share2 className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Share
        </button>
      </div>
      <div
        className={cn("grid gap-2", onWent ? "grid-cols-3" : "grid-cols-2")}
      >
        <button
          type="button"
          {...(reserveLive
            ? { onClick: onReserve, "aria-haspopup": "dialog" as const }
            : inertButtonProps(false))}
          aria-label="Reserve a table"
          className={cn(btn, "bg-foreground text-paper hover:opacity-90")}
        >
          <CalendarCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Reserve
        </button>
        {onWent ? (
          <button
            type="button"
            onClick={onWent}
            aria-pressed={went}
            aria-label={went ? "Take back I went" : "I went here"}
            className={cn(
              grayBtn,
              went && "bg-foreground text-paper hover:bg-foreground",
            )}
          >
            <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            I went
          </button>
        ) : null}
        <button
          type="button"
          {...inertButtonProps(false)}
          aria-label="Pay, Soon"
          className={grayBtn}
        >
          <QrCode className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Pay
          <span className="bg-card text-muted-foreground type-meta rounded-full px-1.5 py-0.5 leading-none font-semibold">
            Soon
          </span>
        </button>
      </div>
    </div>
  );
}
