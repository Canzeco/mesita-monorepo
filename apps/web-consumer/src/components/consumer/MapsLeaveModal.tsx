"use client";

import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { PhotoSignCard } from "@/components/consumer/anonymous/PhotoSignCard";

// MAPS ASKS FIRST (Pato, 2026-11-19, MESITA-4448: "when clicking maps,
// display a confirmation modal explanation that will be redirected to
// Google Maps"). The place screen's Maps tile and its address both open
// Google Maps in a new tab; this says so first, on the mountain card every
// modal wears (MESITA-4338). Open Google Maps opens it; Not now stays.

/** A Google Maps address: google.com/maps, maps.google.*, the goo.gl links. */
export function isGoogleMapsUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host.startsWith("maps.google.")) return true;
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl" && u.pathname.startsWith("/maps")) return true;
  return /^google\.[a-z.]+$/.test(host) && u.pathname.startsWith("/maps");
}

export function MapsLeaveModal({
  url,
  placeName,
  onClose,
}: {
  /** The Maps address waiting for a yes; null when closed. */
  url: string | null;
  placeName: string | null;
  onClose: () => void;
}) {
  return (
    <LocalDialog open={url !== null} onClose={onClose} ariaLabel="Open Google Maps?">
      <PhotoSignCard
        title="Open Google Maps?"
        line={
          placeName
            ? `You'll leave Mesita to get directions to ${placeName}.`
            : "You'll leave Mesita to get directions."
        }
        actionLabel="Open Google Maps"
        onSignIn={() => {
          if (url) window.open(url, "_blank", "noopener,noreferrer");
          onClose();
        }}
        secondLabel="Not now"
        onSecond={onClose}
      />
    </LocalDialog>
  );
}
