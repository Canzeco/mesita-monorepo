"use client";

import { SizedImg } from "@mesita/place-profile";
import { EFError } from "@/lib/api/_invoke";
import type { PayPlace, PayProof } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";

// What the Pay screens share. MESITA-3614 split the one Pay page into a
// screen per address (the list, the bill at the table, the receipt) and the
// form sheet any of them can open.

export const NETWORK_FAILURE = "Couldn't reach Mesita. Tap again.";
export const NOT_TAKING = "This place isn't taking Mesita Payments right now";

export const FIELD_CLASS =
  "border-border bg-background text-foreground placeholder:text-muted-foreground h-12 w-full rounded-xl border px-3 text-base outline-none focus:border-foreground";
/** The quiet second button under the pink one: Resume a Checkout, Done
 *  while one is open. */
export const QUIET_BUTTON_CLASS =
  "border-border bg-card hover:bg-muted min-h-12 w-full rounded-2xl border px-4 text-base font-semibold transition";

/** A 403 or 404 on the read: the payment is not this guest's. */
export const isGone = (e: unknown) => e instanceof EFError && (e.status === 403 || e.status === 404);

/** A payment that is neither settled nor closed: the page keeps confirming. */
export const isOpen = (p: PayProof) => p.status === "open" || p.status === "opening";

/** What the form shows again after a cancelled Checkout (MESITA-3458). */
export type Refill = { placeId: string; amountCents: number; tipCents: number; ticket: string };

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

/** The place's round profile picture, or its first letter. */
export function PlacePhoto({ place, className }: { place: PayPlace; className: string }) {
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
