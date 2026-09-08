"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// The frame every Wallet subroute wears: back, title, body, footer.
//
// FULL SCREEN, NOT A SHEET (Pato, 2026-09-08). Buy, Gift, Redeem and one
// balance were all `LocalSheet`s over the wallet until today. Each is a place
// you can be SENT to — a code in a message, a Back press, a reload, eventually
// a push — and a sheet has no URL, so none of that worked and none of it could
// be built. See newVisit.walletBuy in the route contract for the full reversal.
//
// THE BOTTOM NAV STAYS. (shell)/layout.tsx states the law — "the bottom nav is
// shown on every shell route" — and the one surface that ever hid it (Invite)
// had that reverted specifically because the chrome appeared to break on entry.
// A full-screen view here means it owns the BODY, not the frame: the section
// row above it is what goes (see PaySectionNav), because a guest inside Buy is
// not choosing between QR and Wallet.
//
// BACK IS A HISTORY POP with a fallback, the same shape PlaceDetailPageHeader
// settled on: a guest who arrived from the wallet returns to their scroll
// position, and one who landed cold on a shared code goes to the wallet rather
// than off the end of the app.
//
// THE FOOTER IS OUTSIDE THE SCROLLER on purpose. Every one of these screens
// ends in a single decision — pay, gift, claim — and a CTA that scrolls away is
// a CTA a guest hunts for on a phone. It sits in a bordered band above the tab
// bar, `shrink-0`, so the body scrolls under it.

export function WalletScreen({
  title,
  children,
  footer,
  fallbackHref = CONSUMER_ROUTES.newVisit.wallet,
}: {
  title: string;
  children: React.ReactNode;
  /** The one decision this screen ends in. Omitted on screens that have none. */
  footer?: React.ReactNode;
  /** Where Back lands when there is no history to pop. */
  fallbackHref?: string;
}) {
  const router = useRouter();

  const onBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  }, [router, fallbackHref]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="border-border bg-background/90 sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b px-3 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="bg-card text-foreground border-border hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        {/* h1, not a div: this is the page now, and it is the only heading a
            screen reader can use to say which one. */}
        <h1 className="font-display min-w-0 flex-1 truncate text-center text-xl font-semibold tracking-tight">
          {title}
        </h1>
        {/* Balances the back button so the title is centred on the frame. */}
        <div className="h-9 w-9 shrink-0" aria-hidden />
      </header>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {children}
      </div>

      {footer ? (
        <div className="border-border bg-background shrink-0 border-t px-5 py-4">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** The line that says none of this is money yet. Every Wallet subroute carries
 *  it, because each one is now reachable WITHOUT passing the wallet's own
 *  parked claim on the way in. */
export function WalletParkedNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-xs leading-relaxed">{children}</p>
  );
}
