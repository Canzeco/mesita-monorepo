"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { canRemoveHouseCard, ENTRY_LABEL, entryDate, money, type SentLink } from "@/lib/api/wallet";
import { payPlacePath, payReceiptPath } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { countdownLabel, nextAvailableMs } from "@/lib/wallet-countdown";
import { SendCreditSheet, SentLinks } from "./SendCredit";
import { WalletCard } from "./WalletCard";
import { PRIMARY, SECONDARY } from "./wallet-buttons";
import type { CreditRow } from "./use-wallet";

// A PLACE'S HOUSE CARD (Pato, MESITA-3533: "when you click one method, then
// you open a full screen"): its card, Available and Pending, Pay here, Buy
// credits, Send to a friend, and its history. The body of /wallet/<placeId>
// (MESITA-3614; a sheet over the Wallet until then). Every amount is the
// server's (consumer-web-get-wallet); this screen formats, never adds.
//
// MESITA-3549: a pending history row counts down to the server's
// `available_at`, one 30 s tick per screen; once the soonest one passes (+5 s
// slack) the Wallet reads again, once, and this screen follows that read. A
// held-credit line shows when spendable is below Available; a place gone
// from Mesita keeps its money and says to ask support, with no Pay, Buy or
// place link. A history row that paid a bill opens its receipt.

/** One tick per open House Card. */
const TICK_MS = 30_000;
/** The server turns an entry Available on its own clock: ask a little after. */
const REREAD_SLACK_MS = 5_000;

export function PlaceCredit({
  row,
  canSend,
  sentLinks,
  onReread,
  onRemove,
}: {
  row: CreditRow;
  /** Sending credit is open here (MESITA-3292). */
  canSend: boolean;
  /** Links sent at this place that nobody took yet. */
  sentLinks: SentLink[];
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
  const removable = onRemove !== undefined && canRemoveHouseCard(balance);
  const spendable = balance?.spendable_cents ?? 0;
  const changed = onReread ?? (() => {});
  return (
    <>
      <WalletCard card={{ ...card, tap: { kind: "plain" } }} eager />
      <dl className="border-border mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border" data-house-card-amounts>
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
          <Link href={payPlacePath(row.placeId)} className={PRIMARY}>
            Pay here
          </Link>
          <Link href={`${href}?rewards=prepayment`} className={SECONDARY}>
            Buy credits
          </Link>
          {/* SEND TO A FRIEND (MESITA-3292): same place only, from what can be spent now. */}
          {canSend && spendable > 0 ? (
            <button type="button" className={SECONDARY} onClick={() => setSending(true)} data-send-credit-open>
              Send to a friend
            </button>
          ) : null}
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

      <h3 className="mt-6 mb-1 text-sm font-semibold">History</h3>
      {balance && balance.entries.length > 0 ? (
        <ul className="divide-border divide-y" data-house-card-history>
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
                    href={payReceiptPath(e.payment_id)}
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

      {/* REMOVE FROM WALLET (MESITA-3605, Pato: "enable to remove the card if
          you have 0 credits"): only a card the guest pinned that holds
          nothing and has no history; one short confirm, then the server
          checks the money again (409 has_credit). */}
      {removable ? (
        <>
          <button type="button" className={`${SECONDARY} mt-4`} onClick={() => setConfirming(true)} data-house-card-remove>
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
