"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Gift, Plus, QrCode } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { SizedImg } from "@mesita/place-profile";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Skeleton } from "@/components/shared/Skeleton";
import {
  canRemoveHouseCard,
  entryDate,
  entryLabel,
  money,
  type SentLink,
  type WaitingStory,
} from "@/lib/api/wallet";
import { payPlacePath, payReceiptPath } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { countdownLabel, nextAvailableMs, shouldReread } from "@/lib/wallet-countdown";
import { type EntryGroup, groupKeys, splitEntries } from "@/lib/wallet-entries";
import { cn } from "@/lib/utils";
import { type Method, MethodSheet } from "./MethodSheet";
import { SendCreditSheet, SentLinks } from "./SendCredit";
import { StoryRow, WalletList } from "./WalletLists";
import { PINK_PRIMARY, PINK_SECONDARY, PRIMARY, SECONDARY } from "./wallet-buttons";
import { cardAmount, giftAction } from "@/lib/wallet-card";
import { toast } from "@/lib/toast";
import type { CreditRow } from "./use-wallet";

// A PLACE'S HOUSE CARD, /wallet/<placeId> (MESITA-3741; reordered by
// MESITA-3750, Pato: "is okey if you have a pending there. but don't display
// time there ... imagine i bough two vouchers, one 40 minutes ago, and one 20
// minutes ago ... displaying one time will be wrong"). Top to bottom:
//
//   [mini House Card]     half the column, centred (MESITA-3802): the
//                         place's photo and name, the server's amount (a
//                         muted $0 when nothing is spendable yet, or the
//                         server reads below zero after a refund), "House
//                         Card"; "View place ›" under it
//   Pending Vouchers      only when there are any: Story vouchers waiting for
//                         staff, then one row per purchase with its OWN time,
//                         soonest to land first
//   sent links            links nobody took yet
//   Transactions History  every in and out, newest first; 10, then Show all
//   [Pay] [Buy Credits | Gift Credits]   a bar fixed at the bottom, in
//                         the brand's pink (MESITA-3802, Pato: "put colors to
//                         this stupid buttons for them to be visible")
//   (Remove from Wallet)
//
// Rows come from lib/wallet-entries.ts: a voucher and its bonus are one row
// (the only sum here, display only, both amounts the server's); a purchase
// refunded before it landed reads "Refunded" in History, never as money on
// its way. Every other amount is the server's (consumer-web-get-wallet);
// this screen formats, never adds.
//
// MESITA-3549: a pending row counts down to its own `available_at`, one 30 s
// tick per screen; once the soonest one passes (+5 s) the Wallet reads again.
// MESITA-3750: while a row still reads "Available soon", each tick asks for
// one more read, at most 3 per stuck moment (shouldReread), then stops.

/** One tick per open House Card. */
const TICK_MS = 30_000;
/** The server turns an entry Available on its own clock: ask a little after. */
const REREAD_SLACK_MS = 5_000;
/** History rows before "Show all". */
const HISTORY_FIRST = 10;

/** A pending row's grey line: its own time. */
function timeLine(g: EntryGroup, now: number): string {
  const label = countdownLabel(g.available_at, now);
  if (!label) return "Pending";
  return label.startsWith("in ") ? `Available ${label}` : label;
}

/** A row: what happened, its grey line, how much. */
function EntryRow({ group, currency, now }: { group: EntryGroup; currency: string; now: number }) {
  const when = group.refunded ? "Refunded" : group.pending ? timeLine(group, now) : entryDate(group.at);
  const line = group.bonus_cents ? `${when} · includes ${money(group.bonus_cents, currency)} bonus` : when;
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{entryLabel(group)}</span>
        <span className="text-muted-foreground mt-0.5 block text-sm">{line}</span>
      </span>
      <span className="shrink-0 text-base font-semibold tabular-nums">
        {group.amount_cents > 0 ? "+" : ""}
        {money(group.amount_cents, currency)}
      </span>
    </>
  );
  const row = "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left";
  return group.kind === "spend" && group.payment_id ? (
    <PushLink href={payReceiptPath(group.payment_id)} className={cn(row, "hover:bg-muted/60 transition")}>
      {body}
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
    </PushLink>
  ) : (
    <div className={row}>{body}</div>
  );
}

/** The page loading: the mini House Card and "View place", a History card,
 *  the buttons. */
export function HouseCardSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden>
      <Skeleton className="mx-auto aspect-[1.586] w-1/2 rounded-xl" />
      <Skeleton className="mx-auto mt-4 h-4 w-20 rounded-md" />
      <Skeleton className="mt-5 h-5 w-40 rounded-md" />
      <Skeleton className="mt-2 h-32 w-full rounded-2xl" />
      <Skeleton className="mt-6 h-12 w-full rounded-xl" />
      <div className="mt-2 flex gap-2">
        <Skeleton className="h-12 flex-1 rounded-xl" />
        <Skeleton className="h-12 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

export function PlaceCredit({
  row,
  canSend,
  sentLinks,
  stories = [],
  onReread,
  onRemove,
  startGift = false,
}: {
  row: CreditRow;
  /** Sending credit is open here (MESITA-3292). */
  canSend: boolean;
  /** Links sent at this place that nobody took yet. */
  sentLinks: SentLink[];
  /** Story vouchers bought here that staff have not activated yet. */
  stories?: WaitingStory[];
  onReread?: () => void;
  onRemove?: (placeId: string) => Promise<void>;
  /** Open with Gift Credits showing (Me › Gift, MESITA-3771); only when
   *  sending is open here and there is credit to send. */
  startGift?: boolean;
}) {
  const { card, balance } = row;
  const href = placeHref(row.placeSlug);
  // A balance whose place the server could not name: gone from Mesita.
  const gone = balance !== null && balance.place === null;
  const held = balance !== null && balance.spendable_cents < balance.available_cents;
  const entries = balance?.entries;
  const { pending, history } = splitEntries(entries ?? []);
  const counting = pending.some((g) => g.available_at);
  const [now, setNow] = useState(() => Date.now());
  const [allHistory, setAllHistory] = useState(false);

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

  // A row still "Available soon" on a tick: ask again, at most 3 times per
  // stuck moment. The count is keyed by that moment, so it survives the new
  // entries each read brings; one ask per 30 s tick is the spacing.
  const stuckReads = useRef(new Map<string, number>());
  const stuckAt = pending.find((g) => g.available_at && Date.parse(g.available_at) <= now)?.available_at ?? null;
  useEffect(() => {
    if (!stuckAt || !onReread) return;
    const n = stuckReads.current.get(stuckAt) ?? 0;
    if (!shouldReread(n)) return;
    stuckReads.current.set(stuckAt, n + 1);
    onReread();
  }, [now, stuckAt, onReread]);

  const [sending, setSending] = useState(
    () => startGift && canSend && (balance?.spendable_cents ?? 0) > 0,
  );
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const removable = onRemove !== undefined && canRemoveHouseCard(balance);
  const spendable = balance?.spendable_cents ?? 0;
  const gift = giftAction({ canSend, spendableCents: spendable, shownCents: cardAmount(card).cents });
  const changed = onReread ?? (() => {});
  // Nothing spendable yet: a muted $0, never a minus (a refund can settle
  // before the purchase it refunds lands).
  const muted = card.available_cents <= 0;
  const amount = money(Math.max(0, card.available_cents), card.currency);
  const pendingKeys = groupKeys(pending);
  const shownHistory = allHistory ? history : history.slice(0, HISTORY_FIRST);
  const historyKeys = groupKeys(shownHistory);
  return (
    <>
      {/* THE MINI HOUSE CARD (MESITA-3802, Pato: "instead of that ugly pink
          box display mini House Card, not occupying full width of screen,
          only 50% of screen. card must display amount of credits, name, and
          profile picture"): a card-shaped pink gradient, half the column,
          centred; the place's photo and name, the amount, "House Card". A $0
          is white at reduced opacity, never grey on pink. */}
      <div
        role="img"
        aria-label={`House Card, ${card.name}, ${amount} available`}
        className="relative mx-auto aspect-[1.586] w-1/2 overflow-hidden rounded-xl bg-gradient-to-br from-[var(--brand-pink-500)] to-[var(--brand-pink-800)] p-3 text-white shadow-md"
        data-house-card-amounts
      >
        <span className="pointer-events-none absolute -top-8 -right-6 h-20 w-20 rounded-full bg-white/10" aria-hidden />
        <div className="relative flex items-center gap-1.5" aria-hidden>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/20 type-label font-semibold">
            {card.photo ? (
              <SizedImg src={card.photo} size="thumb" alt="" className="h-full w-full object-cover" />
            ) : (
              (card.name ?? "?").trim().charAt(0).toUpperCase()
            )}
          </span>
          <span className="line-clamp-2 min-w-0 type-label leading-tight font-semibold">{card.name}</span>
        </div>
        <p className={cn("relative mt-3 text-xl font-semibold tabular-nums", muted && "text-white/70")} aria-hidden>
          {amount}
        </p>
        <p className="type-eyebrow relative text-white/80" aria-hidden>House Card</p>
      </div>
      {/* "View place" under the card (MESITA-3788 moved here by MESITA-3802):
          a quiet link to the profile; a place gone from Mesita has no page. */}
      {gone ? null : (
        <PushLink
          href={href}
          className="text-muted-foreground hover:text-foreground mx-auto mt-1 mb-1 flex min-h-11 items-center gap-0.5 px-3 text-sm transition"
          data-house-card-place
        >
          View place
          <ChevronRight className="h-4 w-4" aria-hidden />
        </PushLink>
      )}
      {held ? (
        <p className="text-muted-foreground mt-3 text-sm" data-house-card-held>
          Some credit is held by an open payment. It returns when that payment finishes or expires.
        </p>
      ) : null}
      {gone ? (
        <p className="text-muted-foreground mt-3 text-sm" data-house-card-gone>
          Your credit here stays yours; ask Mesita support to use it.
        </p>
      ) : null}

      {stories.length > 0 || pending.length > 0 ? (
        <WalletList title="Pending Vouchers">
          {stories.map((st) => (
            <StoryRow key={st.purchase_id} story={st} onOpen={() => setMethod({ kind: "story", story: st })} />
          ))}
          {pending.map((g, i) => (
            <EntryRow key={pendingKeys[i]} group={g} currency={card.currency} now={now} />
          ))}
        </WalletList>
      ) : null}

      <SentLinks links={sentLinks} currency={card.currency} onChanged={changed} />

      <WalletList
        title="Transactions History"
        fallback={
          <p className="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-4 text-sm" data-house-card-history-empty>
            No transactions yet
          </p>
        }
      >
        {shownHistory.map((g, i) => (
          <EntryRow key={historyKeys[i]} group={g} currency={card.currency} now={now} />
        ))}
        {!allHistory && history.length > HISTORY_FIRST ? (
          <button
            type="button"
            onClick={() => setAllHistory(true)}
            className="text-muted-foreground hover:bg-muted/60 flex min-h-12 w-full items-center justify-center px-4 py-3 text-sm font-semibold transition"
            data-house-card-history-all
          >
            Show all
          </button>
        ) : null}
      </WalletList>

      <SendCreditSheet
        open={sending}
        onClose={() => setSending(false)}
        onSent={changed}
        placeId={row.placeId}
        placeName={card.name}
        currency={card.currency}
        spendableCents={spendable}
      />
      <MethodSheet method={method} onClose={() => setMethod(null)} />

      {/* REMOVE FROM WALLET (MESITA-3605, Pato: "enable to remove the card if
          you have 0 credits"): only a card the guest pinned that holds
          nothing and has no history; one short confirm, then the server
          checks the money again (409 has_credit). */}
      {removable ? (
        <>
          <button type="button" className={`${SECONDARY} mt-6 mb-6`} onClick={() => setConfirming(true)} data-house-card-remove>
            Remove from Wallet
          </button>
          <LocalSheet open={confirming} onClose={() => (removing ? undefined : setConfirming(false))} ariaLabel="Remove this House Card">
            <div className="flex flex-col px-4 pt-5 pb-8" data-house-card-remove-confirm>
              <h2 className="text-xl font-semibold">Remove this House Card?</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">You can add it again any time.</p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={removing}
                  className={`${PRIMARY} disabled:opacity-60`}
                  onClick={() => {
                    setRemoving(true);
                    void onRemove(row.placeId).finally(() => {
                      setRemoving(false);
                      setConfirming(false);
                    });
                  }}
                >
                  {removing ? "Removing…" : "Remove"}
                </button>
                <button type="button" disabled={removing} className={SECONDARY} onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </LocalSheet>
        </>
      ) : null}
      {/* THE ACTIONS ARE A BAR FIXED AT THE BOTTOM (MESITA-3790, Pato: "the
          buttons fixed at the bottom and all the other boxes scrollable"):
          sticky to the screen's scroller, white with a hairline on top, so
          the card and both histories scroll above it. Pink since MESITA-3802. It closes
          the column, eating the page's bottom padding. */}
      {/* Room between the last list and the bar when the page scrolls. */}
      <div className="h-6 shrink-0" aria-hidden />
      {gone ? null : (
        <div
          className="border-border sticky bottom-0 z-10 -mx-4 mt-auto -mb-8 flex flex-col gap-2 border-t bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          data-house-card-actions
        >
          <PushLink href={payPlacePath(row.placeId)} className={cn(PINK_PRIMARY, "gap-2")} data-house-card-pay>
            <QrCode className="h-4 w-4" aria-hidden />
            Pay
          </PushLink>
          <div className="flex gap-2">
            <PushLink href={`${href}?rewards=prepayment`} className={cn(PINK_SECONDARY, "flex-1 gap-1.5")} data-house-card-fund>
              <Plus className="h-4 w-4" aria-hidden />
              Buy Credits
            </PushLink>
            {gift ? (
              <button
                type="button"
                className={cn(PINK_SECONDARY, "flex-1 gap-1.5", gift !== "open" && "opacity-60")}
                onClick={() => (gift === "open" ? setSending(true) : toast(gift.blocked))}
                aria-label={gift === "open" ? "Gift Credits" : `Gift Credits: ${gift.blocked}`}
                data-send-credit-open
              >
                <Gift className="h-4 w-4" aria-hidden />
                Gift Credits
              </button>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
