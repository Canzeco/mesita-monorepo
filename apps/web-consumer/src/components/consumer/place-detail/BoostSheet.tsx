"use client";

import { Rocket } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  BoostPane,
  BoostUnavailable,
} from "@/components/consumer/place-detail/BoostPane";
import { isMesitaPlaceId } from "@/lib/api/activity";
import type { PlaceBoost } from "@/lib/api/boost";
import type { PlaceDetail } from "@/lib/place-detail";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";

// THE UPGRADE SHEET (Pato, MESITA-3201: "Upgrade just opens a modal on top, like
// contact"): the Upgrade tile, ⋯ › Upgrade and the return from Checkout open it.
// Headed like Contact. A Google-only card is not a place row yet, so there is
// nothing to back; it says so in the consumer's own words (MESITA-2797).
export function BoostSheet({
  place,
  boost,
  loading,
  failed,
  onRetry,
  open,
  onClose,
}: {
  place: PlaceDetail;
  boost: PlaceBoost | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel={`Upgrade ${place.name}`}>
      <div className={SHEET_BODY_CLASS}>
        <div className="flex items-center gap-3">
          <span className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <Rocket className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="boost-title" className={SHEET_TITLE_CLASS}>
              Upgrade
            </h2>
            <p className="text-muted-foreground truncate text-xs">{place.name}</p>
          </div>
        </div>

        {isMesitaPlaceId(place.id) ? (
          <BoostPane
            place={place}
            boost={boost}
            loading={loading}
            failed={failed}
            onRetry={onRetry}
          />
        ) : (
          <BoostUnavailable />
        )}
      </div>
    </LocalSheet>
  );
}
