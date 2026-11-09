"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CreditCard } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { ENTRY_LABEL, entryDate, money, type SentLink, type WaitingStory, type WalletBalance } from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { countdownLabel, nextAvailableMs } from "@/lib/wallet-countdown";
import { SendCreditSheet, SentLinks } from "./SendCredit";
import { WalletCard, type WalletCardModel } from "./WalletCard";

// A PAYMENT METHOD, FULL SCREEN (Pato, MESITA-3533, 2026-11-09: "when you
// click one method, then you open a full screen modal"). Every card on the
// two Wallet rails opens here, in the house full-screen sheet (the Offers
// page's shape): a place's credits, the checkout method, or a Story waiting
// for staff. Every amount is the server's (consumer-web-get-wallet); this
// screen formats, never adds.
//
// MESITA-3549 (the remainder of MESITA-3522): a pending history row counts
// down to the server's `available_at`, one 30 s tick per sheet; once the
// soonest one passes (+5 s slack) the Wallet reads again, once, and the open
// sheet follows that read. A held-credit line shows when spendable is below
// Available; a place gone from Mesita keeps its money and says to ask
// support, with no Pay, Buy or place link.

/** One tick per open place sheet. */
const TICK_MS = 30_000;
/** The server turns an entry Available on its own clock: ask a little after. */
const REREAD_SLACK_MS = 5_000;

export type Method =
  | {
    kind: "place";
    card: WalletCardModel;
    balance: WalletBalance | null;
    /** The place's id and route segment, for Pay and Offers. */
    placeId: string;
    placeSlug: string;
    /** Sending credit is open here (MESITA-3292). */
    canSend: boolean;
    /** Links sent at this place that nobody took yet. */
    sentLinks: SentLink[];
  }
  | { kind: "checkout" }
  | { kind: "story"; story: WaitingStory };

const PRIMARY =
  "bg-foreground text-paper flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-[0.99]";
const SECONDARY =
  "border-border bg-card hover:bg-muted flex h-12 w-full items-center justify-center rounded-xl border text-sm font-semibold transition";

export function MethodSheet({
  method,
  onClose,
  onReread,
}: {
  method: Method | null;
  onClose: () => void;
  /** Read the Wallet again (a pending entry's moment has passed). Stable. */
  onReread?: () => void;
}) {
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
        {method?.kind === "place" ? <PlaceBody method={method} onReread={onReread} /> : null}
        {method?.kind === "checkout" ? <CheckoutBody /> : null}
        {method?.kind === "story" ? <StoryBody story={method.story} /> : null}
      </div>
    </LocalSheet>
  );
}

function PlaceBody({ method, onReread }: { method: Extract<Method, { kind: "place" }>; onReread?: () => void }) {
  const { card, balance } = method;
  const href = placeHref(method.placeSlug);
  // A balance whose place the server could not name: gone from Mesita.
  const gone = balance !== null && balance.place === null;
  const held = balance !== null && balance.spendable_cents < balance.available_cents;
  const entries = balance?.entries;
  const counting = entries?.some((e) => e.pending && e.available_at) ?? false;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [counting]);

  // One re-read when the soonest pending entry turns Available; the new read
  // brings new entries, and this schedules the next one.
  useEffect(() => {
    if (!entries || !onReread) return;
    const t0 = Date.now();
    const next = nextAvailableMs(entries.filter((e) => e.pending).map((e) => e.available_at), t0);
    if (next === null) return;
    const id = setTimeout(onReread, next - t0 + REREAD_SLACK_MS);
    return () => clearTimeout(id);
  }, [entries, onReread]);

  const [sending, setSending] = useState(false);
  const spendable = balance?.spendable_cents ?? 0;
  const changed = onReread ?? (() => {});
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
      {held ? (
        <p className="text-muted-foreground mt-3 text-sm" data-method-held>
          Some credit is held by an open payment. It returns when that payment finishes or expires.
        </p>
      ) : null}
      {gone ? (
        <p className="text-muted-foreground mt-3 text-sm" data-method-gone>
          Your credit here stays yours; ask Mesita support to use it.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <Link href={`${CONSUMER_ROUTES.pay}?place=${encodeURIComponent(method.placeId)}`} className={PRIMARY}>
            Pay here
          </Link>
          <Link href={`${href}?rewards=prepayment`} className={SECONDARY}>
            Buy credits
          </Link>
          {/* SEND TO A FRIEND (MESITA-3292): same place only, from what can be spent now. */}
          {method.canSend && spendable > 0 ? (
            <button type="button" className={SECONDARY} onClick={() => setSending(true)} data-send-credit-open>
              Send to a friend
            </button>
          ) : null}
        </div>
      )}
      <SentLinks links={method.sentLinks} currency={card.currency} onChanged={changed} />
      <SendCreditSheet
        open={sending}
        onClose={() => setSending(false)}
        onSent={changed}
        placeId={method.placeId}
        placeName={card.name}
        currency={card.currency}
        spendableCents={spendable}
      />

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
                  {e.pending ? (
                    <span className="text-muted-foreground font-normal">
                      {" · "}
                      {countdownLabel(e.available_at, now) ?? "pending"}
                    </span>
                  ) : null}
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

      {gone ? null : (
        <Link href={href} className="mt-4 block py-2 text-sm font-semibold underline-offset-4 hover:underline">
          Open place
        </Link>
      )}
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
