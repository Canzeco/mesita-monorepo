"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Gift, Plus, QrCode } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Skeleton } from "@/components/shared/Skeleton";
import {
  canRemoveHouseCard,
  ENTRY_LABEL,
  entryDate,
  money,
  type SentLink,
  type WaitingStory,
  type WalletEntry,
} from "@/lib/api/wallet";
import { payPlacePath, payReceiptPath } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { countdownLabel, nextAvailableMs } from "@/lib/wallet-countdown";
import { cn } from "@/lib/utils";
import { type Method, MethodSheet } from "./MethodSheet";
import { SendCreditSheet, SentLinks } from "./SendCredit";
import { StoryRow, WalletList } from "./WalletLists";
import { PRIMARY, SECONDARY } from "./wallet-buttons";
import { cardAmount, giftAction } from "@/lib/wallet-card";
import { toast } from "@/lib/toast";
import type { CreditRow } from "./use-wallet";

// A PLACE'S HOUSE CARD, /wallet/<placeId> (Pato, 2026-11-11, MESITA-3741:
// "remake this page. and that big card of the top looks like shit. this must
// have: Transactions History, Pending Vouchers (if you bought something and
// has not been activated yet), Go to Pay shortcut button, Buy Credits, Gift
// Credits"). No payment-card face any more. Top to bottom:
//
//   ┌ Available $120 │ Pending $50 ┐   one white card, the server's amounts
//   [ ⌗ Go to Pay ]                     black: this place's Pay (/pay/<id>)
//   [ + Buy Credits ][ 🎁 Gift Credits ]  equal halves
//   Pending Vouchers                    only when there are any: Story
//     vouchers waiting for staff (tap: the QR), then bought credit that is
//     not Available yet, with its countdown
//   Transactions History                every settled entry; a paid bill
//     opens its receipt; "No transactions yet" in the card when empty
//
// Buy Credits is the place's purchase (`?rewards=prepayment`, MESITA-3731's
// Fund). Gift Credits is giftAction's: open the sheet, say why not
// (pending/held credit, or none), or hidden when sending is off. A place
// gone from Mesita keeps its money and says to ask support, with no buttons.
// The held line, the sent links and Remove from Wallet (MESITA-3605) stay.
// Every amount is the server's (consumer-web-get-wallet); this screen
// formats, never adds.
//
// MESITA-3549: a pending entry counts down to the server's `available_at`,
// one 30 s tick per screen; once the soonest one passes (+5 s slack) the
// Wallet reads again, once, and this screen follows that read.

/** One tick per open House Card. */
const TICK_MS = 30_000;
/** The server turns an entry Available on its own clock: ask a little after. */
const REREAD_SLACK_MS = 5_000;

/** A history or pending row: what happened, when, how much. */
function EntryRow({ entry, currency, now }: { entry: WalletEntry; currency: string; now: number }) {
  const line = entry.pending ? (countdownLabel(entry.available_at, now) ?? "Pending") : entryDate(entry.at);
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{ENTRY_LABEL[entry.kind] ?? entry.kind}</span>
        <span className="text-muted-foreground mt-0.5 block truncate text-sm">{line}</span>
      </span>
      <span className="shrink-0 text-base font-semibold tabular-nums">
        {entry.amount_cents > 0 ? "+" : ""}
        {money(entry.amount_cents, currency)}
      </span>
    </>
  );
  const row = "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left";
  return entry.kind === "spend" && entry.payment_id ? (
    <PushLink href={payReceiptPath(entry.payment_id)} className={cn(row, "hover:bg-muted/60 transition")}>
      {body}
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
    </PushLink>
  ) : (
    <div className={row}>{body}</div>
  );
}

/** The page loading: the amounts card and the three buttons. */
export function HouseCardSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-[5.5rem] w-full rounded-2xl" />
      <Skeleton className="mt-2 h-12 w-full rounded-xl" />
      <div className="flex gap-2">
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
}) {
  const { card, balance } = row;
  const href = placeHref(row.placeSlug);
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
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const removable = onRemove !== undefined && canRemoveHouseCard(balance);
  const spendable = balance?.spendable_cents ?? 0;
  const gift = giftAction({ canSend, spendableCents: spendable, shownCents: cardAmount(card).cents });
  const changed = onReread ?? (() => {});
  const pending = (entries ?? []).filter((e) => e.pending);
  const settled = (entries ?? []).filter((e) => !e.pending);
  return (
    <>
      <dl className="border-border bg-card grid grid-cols-2 overflow-hidden rounded-2xl border" data-house-card-amounts>
        <div className="px-4 py-4">
          <dt className="text-muted-foreground text-sm">Available</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{money(card.available_cents, card.currency)}</dd>
        </div>
        <div className="border-border border-l px-4 py-4">
          <dt className="text-muted-foreground text-sm">Pending</dt>
          <dd className={cn("mt-1 text-2xl font-semibold tabular-nums", card.pending_cents === 0 && "text-muted-foreground")}>
            {money(card.pending_cents, card.currency)}
          </dd>
        </div>
      </dl>
      {held ? (
        <p className="text-muted-foreground mt-3 text-sm" data-house-card-held>
          Some credit is held by an open payment. It returns when that payment finishes or expires.
        </p>
      ) : null}
      {gone ? (
        <p className="text-muted-foreground mt-3 text-sm" data-house-card-gone>
          Your credit here stays yours; ask Mesita support to use it.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <PushLink href={payPlacePath(row.placeId)} className={cn(PRIMARY, "gap-2")} data-house-card-pay>
            <QrCode className="h-4 w-4" aria-hidden />
            Go to Pay
          </PushLink>
          <div className="flex gap-2">
            <PushLink href={`${href}?rewards=prepayment`} className={cn(SECONDARY, "flex-1 gap-1.5")} data-house-card-fund>
              <Plus className="h-4 w-4" aria-hidden />
              Buy Credits
            </PushLink>
            {gift ? (
              <button
                type="button"
                className={cn(SECONDARY, "flex-1 gap-1.5", gift !== "open" && "text-muted-foreground")}
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
      <SentLinks links={sentLinks} currency={card.currency} onChanged={changed} />
      <SendCreditSheet
        open={sending}
        onClose={() => setSending(false)}
        onSent={changed}
        placeId={row.placeId}
        placeName={card.name}
        currency={card.currency}
        spendableCents={spendable}
      />

      {stories.length > 0 || pending.length > 0 ? (
        <WalletList title="Pending Vouchers">
          {stories.map((st) => (
            <StoryRow key={st.purchase_id} story={st} onOpen={() => setMethod({ kind: "story", story: st })} />
          ))}
          {pending.map((e, i) => (
            <EntryRow key={`p${i}`} entry={e} currency={card.currency} now={now} />
          ))}
        </WalletList>
      ) : null}

      <WalletList
        title="Transactions History"
        fallback={
          <p className="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-4 text-sm" data-house-card-history-empty>
            No transactions yet
          </p>
        }
      >
        {settled.map((e, i) => (
          <EntryRow key={i} entry={e} currency={card.currency} now={now} />
        ))}
      </WalletList>
      <MethodSheet method={method} onClose={() => setMethod(null)} />

      {/* REMOVE FROM WALLET (MESITA-3605, Pato: "enable to remove the card if
          you have 0 credits"): only a card the guest pinned that holds
          nothing and has no history; one short confirm, then the server
          checks the money again (409 has_credit). */}
      {removable ? (
        <>
          <button type="button" className={`${SECONDARY} mt-6`} onClick={() => setConfirming(true)} data-house-card-remove>
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
    </>
  );
}
