import { placeHref } from "@/lib/place-route";
import { toast } from "@/lib/toast";

// Sharing anything: the OS share sheet where there is one, the clipboard
// where there is not. Every share control in the app goes through
// `shareOrCopy` (Pato, MESITA-2581: "make the share button functional").
//
// THREE OUTCOMES, AND ALL THREE HAVE TO BE VISIBLE. The Web Share API is
// absent on most desktop browsers, REFUSES some data (`canShare` false), and
// REJECTS — AbortError when the guest dismisses the sheet, NotAllowedError or
// InvalidStateError when the platform will not open it (a desktop Chrome in
// the phone frame, a second tap while a sheet is open). A naive
// `navigator.share(...)` therefore does nothing at all on half the surfaces.
//
//   sheet opens       -> the OS sheet; success is the sheet closing
//   no sheet / fails  -> clipboard + ONE toast that SAYS what was copied
//   guest dismissed   -> nothing, silently (AbortError is not a failure)
//
// One tap, one toast at most: the copy is the fallback, never an addition
// to a sheet that opened (MESITA-2561 showed "Link copied" and "Couldn't
// share" at once).
//
// THE URL CARRIES THE PLACE AND NOTHING ELSE. No coordinates, no session
// token, no referrer id — `/place/[id]` is already the canonical public
// address and already renders for a signed-out visitor via its hard route.
// Appending the guest's location to a link they are about to hand someone
// else is the one way this helper could leak something.

/** True when the platform can open a native share sheet (for this data). */
export function canShareNatively(data?: ShareData): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  if (data && typeof navigator.canShare === "function") {
    try {
      return navigator.canShare(data);
    } catch {
      return false;
    }
  }
  return true;
}

/** Absolute URL for a place, for handing to someone outside the app. */
function placeShareUrl(idOrSlug: string): string {
  const path = placeHref(idOrSlug);
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

/** The pre-Clipboard-API copy: a hidden textarea and `execCommand`. */
function copyWithTextarea(text: string): boolean {
  if (typeof document === "undefined") return false;
  if (typeof document.execCommand !== "function") return false;
  const area = document.createElement("textarea");
  area.value = text;
  // readOnly keeps the iOS keyboard down; off-screen keeps the page still.
  area.readOnly = true;
  area.setAttribute("aria-hidden", "true");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  document.body.appendChild(area);
  try {
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * Copy text. The Clipboard API first; where it is missing or refuses
 * (permission denied, insecure context, a document that lost focus), the
 * textarea fallback. Never throws.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea.
  }
  return copyWithTextarea(text);
}

export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

/**
 * The share sheet, or a copy and one toast. Never throws and never rejects —
 * every caller is an onClick, and a rejected promise there is an unhandled
 * rejection.
 */
export async function shareOrCopy(
  data: ShareData,
  fallback: { text: string; copied: string; failed: string },
): Promise<ShareOutcome> {
  if (canShareNatively(data)) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      // The guest closing the sheet is a decision, not a failure. Anything
      // else falls through to the clipboard so the tap still does something.
      if (err instanceof DOMException && err.name === "AbortError")
        return "cancelled";
    }
  }
  if (await copyToClipboard(fallback.text)) {
    toast.success(fallback.copied);
    return "copied";
  }
  toast.error(fallback.failed);
  return "failed";
}

/** Share a place, or copy its link. */
export async function sharePlace(place: {
  id: string;
  slug?: string | null;
  name: string;
}): Promise<ShareOutcome> {
  const url = placeShareUrl(place.slug ?? place.id);
  return shareOrCopy(
    { title: place.name, url },
    { text: url, copied: "Link copied", failed: "Couldn't share this place" },
  );
}
