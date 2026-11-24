"use client";

import { SizedImg } from "@mesita/place-profile";
import { EFError } from "@/lib/api/_invoke";
import type { PayPlace, PayProof } from "@/lib/api/wallet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// What the Pay screens share. MESITA-3614 split the one Pay page into a
// screen per address (the list, the bill at the table, the receipt) and the
// form sheet any of them can open.

export const NETWORK_FAILURE = "Couldn't reach Mesita. Tap again.";
export const NOT_TAKING = "This place isn't taking App Payments right now";

export const FIELD_CLASS =
  "border-border bg-background text-foreground placeholder:text-muted-foreground h-12 w-full rounded-xl border px-3 text-base outline-none focus:border-foreground";
/** The quiet second button under the pink one: Done, Refresh. */
export const QUIET_BUTTON_CLASS =
  "border-border bg-card hover:bg-muted min-h-12 w-full rounded-2xl border px-4 text-base font-semibold transition";

/** The two buttons of every "Cancel this bill?" dialog (MESITA-4239, Pato:
 *  "this button must be red, and smaller ... non standardized"): the red
 *  Cancel bill beside an outlined Keep it, both the standard dialog size
 *  (h-11, text-sm, round), as the reservation cancel dialog. */
export function CancelBillButtons({ busy, disabled, onCancel, onKeep }: { busy?: boolean; disabled?: boolean; onCancel: () => void; onKeep: () => void }) {
  return (
    <div className="mt-4 flex gap-2">
      <Button variant="danger" className="flex-1 px-4 text-sm font-semibold" disabled={disabled} onClick={onCancel}>
        {busy ? "Cancelling…" : "Cancel bill"}
      </Button>
      <button
        type="button"
        className="border-border bg-card hover:bg-muted inline-flex h-11 flex-1 items-center justify-center rounded-full border px-4 text-sm font-semibold transition"
        onClick={onKeep}
      >
        Keep it
      </button>
    </div>
  );
}

/** A 403 or 404 on the read: the payment is not this guest's. */
export const isGone = (e: unknown) => e instanceof EFError && (e.status === 403 || e.status === 404);

/** A payment that is neither settled nor closed: the page keeps confirming. */
export const isOpen = (p: PayProof) => p.status === "open" || p.status === "opening";

/** The guest's open bill at the table (MESITA-3572): its id stays on this
 *  device so the Pay list can lead with it. The server is the truth: a bill
 *  that reads paid, expired or cancelled is forgotten. */
const OPEN_TAB_KEY = "mesita.pay.open-tab";
export const OPEN_TAB_STATUSES = new Set(["waiting_bill", "billed", "paying"]);

export function readOpenTabId(): string | null {
  try {
    return window.localStorage.getItem(OPEN_TAB_KEY);
  } catch {
    return null;
  }
}

export function writeOpenTabId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(OPEN_TAB_KEY, id);
    else window.localStorage.removeItem(OPEN_TAB_KEY);
  } catch {
    // Private mode or blocked storage: the list just doesn't lead with it.
  }
}

/** MESITA-3709: the guest's own payments (guest tabs) on this device, newest
 *  first, so the Pay list shows them In progress and their QR survives a
 *  reload. The QR's link (service.mesita.ai/tab/<token>) is only a key to the
 *  waiter's Verify page; it is kept until the waiter verifies or the
 *  three-hour window ends. The server is the truth. */
const GUEST_TABS_KEY = "mesita.pay.guest-tabs";
const guestQrKey = (tabId: string) => `mesita.pay.guest-token.${tabId}`;

export function readGuestTabIds(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(GUEST_TABS_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function rememberGuestTab(tabId: string, qrUrl: string | null) {
  try {
    const ids = [tabId, ...readGuestTabIds().filter((x) => x !== tabId)].slice(0, 10);
    window.localStorage.setItem(GUEST_TABS_KEY, JSON.stringify(ids));
    if (qrUrl) window.localStorage.setItem(guestQrKey(tabId), qrUrl);
  } catch {
    // Private mode: the list forgets it and the QR is minted again on reload.
  }
}

export function forgetGuestTab(tabId: string) {
  try {
    window.localStorage.setItem(GUEST_TABS_KEY, JSON.stringify(readGuestTabIds().filter((x) => x !== tabId)));
    window.localStorage.removeItem(guestQrKey(tabId));
  } catch {
    // Nothing to forget.
  }
}

export function readGuestQr(tabId: string): string | null {
  try {
    return window.localStorage.getItem(guestQrKey(tabId));
  } catch {
    return null;
  }
}

/** The place's profile picture, or its first letter: always a circle (Pato,
 *  2026-11-24, MESITA-4832: "profile picture must be circular").  */
export function PlacePhoto({ place, className }: { place: Pick<PayPlace, "photo" | "name">; className: string }) {
  return (
    <span className={cn("bg-muted shrink-0 overflow-hidden rounded-full ring-1 ring-black/5", className)} aria-hidden>
      {place.photo ? (
        <SizedImg src={place.photo} size="thumb" alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="text-muted-foreground flex h-full w-full items-center justify-center text-base font-semibold">
          {(place.name ?? "M").trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
