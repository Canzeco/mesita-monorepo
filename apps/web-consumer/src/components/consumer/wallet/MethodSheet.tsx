"use client";

import Link from "next/link";
import { ChevronLeft, CreditCard } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { ENTRY_LABEL, entryDate, money, type WaitingStory, type WalletBalance } from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { WalletCard, type WalletCardModel } from "./WalletCard";

// A PAYMENT METHOD, FULL SCREEN (Pato, MESITA-3533, 2026-11-09: "when you
// click one method, then you open a full screen modal"). Every card on the
// two Wallet rails opens here, in the house full-screen sheet (the Offers
// page's shape): a place's credits, the checkout method, or a Story waiting
// for staff. Every amount is the server's (consumer-web-get-wallet); this
// screen formats, never adds.

export type Method =
  | {
    kind: "place";
    card: WalletCardModel;
    balance: WalletBalance | null;
    /** The place's id and route segment, for Pay and Offers. */
    placeId: string;
    placeSlug: string;
  }
  | { kind: "checkout" }
  | { kind: "story"; story: WaitingStory };

const PRIMARY =
  "bg-foreground text-paper flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-[0.99]";
const SECONDARY =
  "border-border bg-card hover:bg-muted flex h-12 w-full items-center justify-center rounded-xl border text-sm font-semibold transition";

export function MethodSheet({ method, onClose }: { method: Method | null; onClose: () => void }) {
  const title = method?.kind === "place"
    ? method.card.name
    : method?.kind === "story"
      ? "Story voucher"
      : "Card · Apple Pay · Google Pay";
  return (
    <LocalSheet open={method !== null} onClose={onClose} ariaLabel={title} fullScreen>
      <div className="border-border flex items-center gap-2 border-b px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="hover:bg-muted flex h-11 w-11 items-center justify-center rounded-xl transition"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <h2 className="min-w-0 truncate text-base font-semibold">{title}</h2>
      </div>
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-5 pb-8">
        {method?.kind === "place" ? <PlaceBody method={method} /> : null}
        {method?.kind === "checkout" ? <CheckoutBody /> : null}
        {method?.kind === "story" ? <StoryBody story={method.story} /> : null}
      </div>
    </LocalSheet>
  );
}

function PlaceBody({ method }: { method: Extract<Method, { kind: "place" }> }) {
  const { card, balance } = method;
  const href = placeHref(method.placeSlug);
  return (
    <>
      <WalletCard card={{ ...card, tap: { kind: "plain" } }} eager />
      <dl className="border-border mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border" data-method-amounts>
        <div className="px-4 py-3">
          <dt className="text-muted-foreground text-xs">Available</dt>
          <dd className="text-lg font-semibold tabular-nums">{money(card.available_cents, card.currency)}</dd>
        </div>
        <div className="border-border border-l px-4 py-3">
          <dt className="text-muted-foreground text-xs">Pending</dt>
          <dd className="text-lg font-semibold tabular-nums">{money(card.pending_cents, card.currency)}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-col gap-2">
        <Link href={`${CONSUMER_ROUTES.pay}?place=${encodeURIComponent(method.placeId)}`} className={PRIMARY}>
          Pay here
        </Link>
        <Link href={`${href}?rewards=prepayment`} className={SECONDARY}>
          Buy credits
        </Link>
      </div>

      <h3 className="mt-6 mb-1 text-sm font-semibold">History</h3>
      {balance && balance.entries.length > 0 ? (
        <ul className="divide-border divide-y" data-method-history>
          {balance.entries.map((e, i) => {
            const row = (
              <>
                <span>
                  {ENTRY_LABEL[e.kind] ?? e.kind}
                  <span className="text-muted-foreground"> · {entryDate(e.at)}</span>
                </span>
                <span className="font-semibold tabular-nums">
                  {e.amount_cents > 0 ? "+" : ""}
                  {money(e.amount_cents, card.currency)}
                  {e.pending ? <span className="text-muted-foreground font-normal"> · pending</span> : null}
                </span>
              </>
            );
            return (
              <li key={i}>
                {e.kind === "spend" && e.payment_id ? (
                  <Link
                    href={`${CONSUMER_ROUTES.pay}?payment=${encodeURIComponent(e.payment_id)}`}
                    className="flex items-center justify-between py-3 text-sm underline-offset-4 hover:underline"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between py-3 text-sm">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Nothing here yet. Credits you buy at this place show up here.</p>
      )}

      <Link href={href} className="mt-4 block py-2 text-sm font-semibold underline-offset-4 hover:underline">
        Open place
      </Link>
    </>
  );
}

function CheckoutBody() {
  return (
    <>
      <div className="flex aspect-[1.586/1] w-full flex-col justify-between rounded-2xl bg-white p-5 ring-1 ring-black/10">
        <span className="bg-muted flex h-10 w-10 items-center justify-center rounded-full" aria-hidden>
          <CreditCard className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-semibold">Card · Apple Pay · Google Pay</p>
          <p className="text-muted-foreground mt-0.5 text-sm">Chosen at checkout, every time you pay</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
        <p>When you pay a bill or buy credits with Mesita Pay, you pick a card, Apple Pay or Google Pay on the checkout page.</p>
        <p>Mesita doesn&apos;t keep your card. Saving a card for one-tap payments comes soon.</p>
      </div>
      <Link href={CONSUMER_ROUTES.pay} className={`${PRIMARY} mt-5`}>
        Pay a bill
      </Link>
    </>
  );
}

function StoryBody({ story }: { story: WaitingStory }) {
  const name = story.place?.name ?? "this place";
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm leading-relaxed">
        {money(story.credit_cents, story.currency)} of credit at {name} waits for step 2: post an Instagram story at
        the place, tag it, and show the story and this QR to the staff.
      </p>
      <QRCodeSVG value={story.url} size={224} marginSize={0} aria-label="Story voucher activation code" />
    </div>
  );
}
