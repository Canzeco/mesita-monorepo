import { placeHref } from "@/lib/place-route";
import { toast } from "@/lib/toast";

// Sharing a place — the real thing, replacing the ComingSoonModal that
// place detail's Share button opened from #1371 to MESITA-1697.
//
// THREE OUTCOMES, AND ALL THREE HAVE TO BE VISIBLE. The Web Share API is
// absent on desktop Safari and every desktop Chrome without the flag, and it
// REJECTS with AbortError whenever the guest dismisses the OS sheet. A naive
// `navigator.share(...)` therefore does nothing at all on half the surfaces
// and logs an unhandled rejection on the other half — an action that silently
// no-ops is the worst control on a card whose whole job is one tap.
//
//   share available   -> the OS sheet; success is the sheet closing
//   share absent      -> clipboard + a toast that SAYS the link was copied
//   guest dismissed   -> nothing, silently (AbortError is not a failure)
//
// The AbortError swallow copies ReservationDetailModalShell's shipped pattern
// rather than inventing a second one.
//
// THE URL CARRIES THE PLACE AND NOTHING ELSE. No coordinates, no session
// token, no referrer id — `/place/[id]` is already the canonical public
// address and already renders for a signed-out visitor via its hard route.
// Appending the guest's location to a link they are about to hand someone
// else is the one way this helper could leak something.

/** True when the platform can open a native share sheet. */
export function canShareNatively(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** Absolute URL for a place, for handing to someone outside the app. */
export function placeShareUrl(idOrSlug: string): string {
  const path = placeHref(idOrSlug);
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied, insecure context, or a browser that refuses the
    // write outside a user gesture. Fall through to the failure toast.
  }
  return false;
}

/**
 * Share a place, or copy its link. Never throws and never rejects — every
 * caller is an onClick, and a rejected promise there is an unhandled rejection.
 */
export async function sharePlace(place: {
  id: string;
  slug?: string | null;
  name: string;
}): Promise<void> {
  const url = placeShareUrl(place.slug ?? place.id);

  if (canShareNatively()) {
    try {
      await navigator.share({ title: place.name, url });
      return;
    } catch (err) {
      // The guest closing the sheet is a decision, not a failure. Anything
      // else falls through to the clipboard so the tap still does something.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const copied = await copyToClipboard(url);
  if (copied) toast.success("Link copied");
  else toast.error("Couldn't share this place");
}
