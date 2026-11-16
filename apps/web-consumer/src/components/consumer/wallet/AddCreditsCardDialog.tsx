"use client";

import { CreditCard, Gift, HandCoins, X, type LucideIcon } from "lucide-react";

import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// HOW A CREDITS CARD GETS ADDED (Pato, 2026-11-15, MESITA-4088): Wallet's
// "Add a Credits Card" row opens this centred dialog instead of sending the
// guest to Search. A Credits Card is never added by hand: it appears the
// first time the guest holds credit at a place, by one of three doors. The
// words are Pato's, checked first: no per-place numbers ("5%"), no "tap
// here". A gift code is Wallet's own Claim Gift button, so no link here.
// Closes on the X, the backdrop, Escape and Close; 16px on every side.

const WAYS: { icon: LucideIcon; title: string; line: string }[] = [
  {
    icon: CreditCard,
    title: "Buy credits at a place",
    line: "Prepay on its page and get a bonus.",
  },
  {
    icon: Gift,
    title: "Get a gift",
    line: "A friend sends you credits for a place.",
  },
  {
    icon: HandCoins,
    title: "Earn cashback",
    line: "Pay with the app and get part of it back.",
  },
];

export function AddCreditsCardDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LocalDialog
      open={open}
      onClose={onClose}
      ariaLabel="Loyalty Cards add themselves"
    >
      <div data-add-credits-card-dialog>
        <div className="flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Loyalty Cards add themselves
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              A place&apos;s card appears here the first time you get credits
              there.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="hover:bg-muted -m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <ul role="list" className="border-border border-t">
          {WAYS.map(({ icon: Icon, title, line }, i) => (
            <li
              key={title}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-border border-t" : ""}`}
            >
              <span
                className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                aria-hidden
              >
                <Icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="text-muted-foreground block text-sm">
                  {line}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="border-border flex flex-col gap-1 border-t p-4">
          <PushLink
            href={CONSUMER_ROUTES.search}
            onClick={onClose}
            className="bg-foreground text-paper flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90"
            data-add-credits-card-find
          >
            Find a place
          </PushLink>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground h-11 w-full text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </LocalDialog>
  );
}
