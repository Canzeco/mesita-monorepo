"use client";

// ONE CREDIT MOVEMENT, ONE PAGE: /me/tickets/credit/<placeId>/<kind>.<ms>
// (MESITA-3782, Tickets 4/10 MESITA-4004). A Vouchers, Gifts or Refunds row
// opens it, built from TicketParts like the Visit page:
//
//   TicketHeader     photo + badge, the place, when, "+$500.00MX", its state
//                    (Available, Pending · available <date>, Refunded <date>)
//   YOUR CREDIT      Bought · Bonus · Cashback · Total credit (a gift or a
//                    refund: its Type)
//   AT <PLACE>       Available · Pending · You can spend now
//   Pay here (filled, when spendable) · Open the House Card (outline)
//   Gift credit      a quiet text link, when sending is allowed
//
// A refunded purchase reads Refunded <date> and links to its Refund ticket by
// purchase_id; the purchase number has a copy button. It reads the wallet
// Tickets already holds (the same cached read); an entry it cannot find any
// more says so and goes back to Tickets.

import Link from "next/link";
import { BadgeDollarSign, Copy } from "lucide-react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import type { TicketRowKind } from "./ActivityRow";
import {
  TestModeNote,
  TicketActions,
  TicketCard,
  TicketHeader,
  TicketLine,
  TicketSkeleton,
  type TicketTone,
} from "./TicketParts";
import { ticketsHref } from "@/lib/ticket-kinds";
import {
  apiGetWallet,
  entryDate,
  entryLabel,
  money,
  WALLET_CACHE_KEY,
  type Wallet,
  type WalletEntry,
} from "@/lib/api/wallet";
import { creditEntryPath, payPlacePath, placePath, walletPlacePath } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { useCachedQuery } from "@/lib/use-cached-query";

const when = (iso: string) =>
  `${new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${clockTime(iso)}`;

const BOUGHT = new Set(["prepay", "voucher"]);

/** The header's kind badge for an entry. */
function badgeOf(e: WalletEntry): TicketRowKind {
  switch (e.kind) {
    case "bonus":
    case "gift_in":
    case "gift_out":
    case "gift_back":
      return e.kind;
    case "reversal":
    case "refund":
      return "refund";
    default:
      return "voucher";
  }
}

/** The state word and its tone. A purchase with a refund on it reads
 *  Refunded <date>, never as money on its way (MESITA-3753). */
function stateOf(e: WalletEntry, refund: WalletEntry | undefined): [string, TicketTone] {
  if (e.kind === "reversal") return [`Refunded ${entryDate(e.at)}`, "grey"];
  if (refund) return [`Refunded ${entryDate(refund.at)}`, "grey"];
  if (e.kind === "gift_out") return [e.pending ? "Sent · pending" : "Sent", "ink"];
  if (e.kind === "gift_back") return ["Back in your balance", "green"];
  if (e.pending)
    return [e.available_at ? `Pending · available ${entryDate(e.available_at)}` : "Pending", "ink"];
  return [e.kind === "gift_in" ? "Received · available" : "Available", "green"];
}

/** The purchase number's copy button: the full id goes to the clipboard. */
function CopyPurchaseId({ id }: { id: string }) {
  return (
    <button
      type="button"
      aria-label="Copy the purchase number"
      className="text-muted-foreground hover:bg-muted/60 -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition"
      onClick={() => {
        void navigator.clipboard
          .writeText(id)
          .then(() => toast("Copied"))
          .catch(() => toast.error("Couldn't copy"));
      }}
    >
      <Copy className="h-4 w-4" aria-hidden />
    </button>
  );
}

export function CreditEntry({ placeId, entryKey }: { placeId: string; entryKey: string }) {
  const getSupabase = useLazyBrowserSupabase();
  // The same read and key Tickets holds, so a tap from the list paints at once.
  const wallet = useCachedQuery<Wallet>(WALLET_CACHE_KEY, () => apiGetWallet(getSupabase()), {
    ttl: 2 * 60 * 1000,
  });

  const body = (() => {
    if (!wallet.data) {
      return wallet.error ? (
        <EmptyState
          icon={BadgeDollarSign}
          title="Couldn't load this credit"
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: () => wallet.reload() }}
        />
      ) : (
        <TicketSkeleton />
      );
    }
    const b = wallet.data.balances.find((x) => x.place_id === placeId);
    const [kind, ms] = entryKey.split(".");
    // By kind and instant; when several share them (a purchase's reversals),
    // the largest amount is the page's entry (MESITA-4004).
    const e = b?.entries
      .filter((x) => x.kind === kind && String(Date.parse(x.at)) === ms)
      .sort((x, y) => Math.abs(y.amount_cents) - Math.abs(x.amount_cents))[0];
    if (!b || !e) {
      return (
        <EmptyState
          icon={BadgeDollarSign}
          title="This credit isn't here any more"
          description="It may have moved since the list loaded."
          action={{ label: "Back to Tickets", href: ticketsHref() }}
        />
      );
    }
    const place = b.place?.name ?? "A Mesita place";
    const m = (c: number) => money(c, b.currency);
    const amount = Math.abs(e.amount_cents);
    const bought = BOUGHT.has(e.kind);
    // The bonus written with this purchase: by its purchase when the read
    // carries one, else by the same instant.
    const bonus = bought
      ? b.entries.find((x) => x.kind === "bonus" && (e.purchase_id ? x.purchase_id === e.purchase_id : x.at === e.at))
      : undefined;
    // The cashback this purchase earned (a cashback with its purchase id and
    // no payment id, MESITA-4003).
    const cashback =
      bought && e.purchase_id
        ? b.entries
            .filter((x) => x.kind === "cashback" && !x.payment_id && x.purchase_id === e.purchase_id)
            .reduce((n, x) => n + x.amount_cents, 0)
        : 0;
    // The refund of this purchase: its largest reversal.
    const refund = bought && e.purchase_id
      ? b.entries
          .filter((x) => x.kind === "reversal" && x.purchase_id === e.purchase_id)
          .sort((x, y) => Math.abs(y.amount_cents) - Math.abs(x.amount_cents))[0]
      : undefined;
    const [state, tone] = stateOf(e, refund);
    const out = e.kind === "gift_out" || e.kind === "reversal";
    const canGift = wallet.data.can_send === true && b.spendable_cents > 0;
    const houseCard = { label: "Open the House Card", href: walletPlacePath(placeId) };
    return (
      <div className="flex flex-col gap-6 pb-4" data-credit-entry>
        <TicketHeader
          kind={badgeOf(e)}
          photo={b.place?.photo ?? null}
          place={place}
          placeHref={b.place?.id ? placePath(b.place.id) : undefined}
          when={when(e.at)}
          amount={out ? `−${m(amount)}` : bought || e.kind === "bonus" || e.kind === "gift_in" ? `+${m(amount)}` : m(amount)}
          state={state}
          tone={tone}
          dim={e.kind === "reversal" || refund !== undefined}
        />
        {wallet.data.test_mode ? <TestModeNote /> : null}

        {bought ? (
          <TicketCard title="Your credit">
            <TicketLine label="Bought" value={m(amount)} />
            {bonus ? <TicketLine label="Bonus" value={`+${m(bonus.amount_cents)}`} /> : null}
            {cashback > 0 ? <TicketLine label="Cashback" value={`+${m(cashback)}`} /> : null}
            {bonus || cashback > 0 ? (
              <TicketLine label="Total credit" value={m(amount + (bonus?.amount_cents ?? 0) + cashback)} strong />
            ) : null}
          </TicketCard>
        ) : (
          <TicketCard title="Details">
            <TicketLine label="Type" value={entryLabel(e)} />
          </TicketCard>
        )}

        {refund ? (
          <TicketCard title="Refund">
            <TicketLine
              label="Refund ticket"
              sub={when(refund.at)}
              value={m(Math.abs(refund.amount_cents))}
              href={creditEntryPath(placeId, refund)}
            />
          </TicketCard>
        ) : null}

        <TicketCard title={`At ${place}`}>
          <TicketLine label="Available" value={m(b.available_cents)} />
          {b.pending_cents > 0 ? <TicketLine label="Pending" value={m(b.pending_cents)} /> : null}
          <TicketLine label="You can spend now" value={m(b.spendable_cents)} strong />
        </TicketCard>

        {e.purchase_id ? (
          <TicketCard title="Purchase">
            <TicketLine
              label="Purchase number"
              value={e.purchase_id.slice(0, 8).toUpperCase()}
              trailing={<CopyPurchaseId id={e.purchase_id} />}
            />
          </TicketCard>
        ) : null}

        {b.spendable_cents > 0 ? (
          <TicketActions primary={{ label: "Pay here", href: payPlacePath(placeId) }} secondary={houseCard} />
        ) : (
          <Link
            href={houseCard.href}
            className="border-border bg-card hover:bg-muted/60 flex h-11 items-center justify-center rounded-full border text-sm font-semibold transition"
          >
            {houseCard.label}
          </Link>
        )}
        {canGift ? (
          <Link
            href={`${walletPlacePath(placeId)}?gift=1`}
            className="text-muted-foreground hover:text-foreground -mt-2 self-center py-2 text-sm font-medium underline-offset-4 transition hover:underline"
          >
            Gift credit
          </Link>
        ) : null}
      </div>
    );
  })();

  return <MeScreen title="Credit">{body}</MeScreen>;
}
