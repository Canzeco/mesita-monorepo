"use client";

import { Heart, Phone, Share2 } from "lucide-react";

import type { PlaceActions } from "../../actions";
import { inertButtonProps } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";

// Save · Contact · Share. Live behavior (bookmark, contact sheet, share
// sheet) stays in the consumer and arrives as callbacks. Missing callbacks
// leave the buttons visible and inert.
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

  // Instagram profile buttons: filled muted, no border (MESITA-2315).
  const outlineBtn =
    "bg-muted text-foreground hover:bg-muted/70 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg type-body font-semibold whitespace-nowrap transition active:scale-[0.99]";

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <button
        type="button"
        {...(onSave
          ? { onClick: onSave, "aria-pressed": saved }
          : inertButtonProps(false))}
        aria-label={saved ? "Remove from saved" : "Save place"}
        className={cn(
          outlineBtn,
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
        className={outlineBtn}
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
        className={outlineBtn}
      >
        <Share2 className="h-4 w-4 shrink-0" strokeWidth={2.25} />
        Share
      </button>
    </div>
  );
}
