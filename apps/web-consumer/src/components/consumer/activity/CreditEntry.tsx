"use client";

// ONE CREDIT MOVEMENT, ONE PAGE: /me/tickets/credit/<placeId>/<kind>.<ms>
// (MESITA-3782, Pato: "make UX/UI and tickets right like the related details
// there"). A Vouchers or Gifts row opens it: a voucher or prepay bought, its
// bonus, a bonus alone, a refunded purchase, credit sent, received or taken
// back. Top to bottom:
//
//   Taquería Orinoco · Tue, Nov 10 · 20:14     the place, when
//   $500.00MX                                  the amount, large
//   Available                                  its state, coloured
//
//   WHAT THIS IS     one paragraph for its kind
//   DETAILS          type · amount · bonus · total credit · date · state
//                    (pending: when it turns available) · purchase number
//   AT THIS PLACE    available · pending · spendable now
//   Open the House Card · Pay here · Gift credit
//
// A House Card row opens it too (MESITA-3753), and a purchase with a refund
// on it reads Refunded with the refund's date.
//
// It reads the wallet Tickets already holds (the same cached read); an entry
// it cannot find any more says so and goes back to Tickets.

import type { ReactNode } from "react";
import Link from "next/link";
import { BadgeDollarSign } from "lucide-react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { Screen } from "@/components/consumer/nav/Screen";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { ticketsHref } from "@/lib/ticket-kinds";
import { apiGetWallet, entryLabel, money, WALLET_CACHE_KEY, type Wallet, type WalletEntry } from "@/lib/api/wallet";
import { payPlacePath, walletPlacePath } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";
import { cn } from "@/lib/utils";

const when = (iso: string) =>
  `${new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${clockTime(iso)}`;

const BOUGHT = new Set(["prepay", "voucher"]);

/** What a movement is, in words, at `place`. */
function explain(e: WalletEntry, place: string, refunded: boolean): string {
  switch (e.kind) {
    case "prepay":
    case "voucher":
      if (refunded) return `You bought this credit at ${place} and it was refunded to the card you paid with. It is no longer in your balance there.`;
      return `You bought this credit at ${place}. Spend it there with Pay: it pays the bill, never the tip. If ${place} closes for good, Mesita refunds what you have left.`;
    case "bonus":
      return `Extra credit ${place} added when you bought credit. Spend it there like the rest of your credit.`;
    case "reversal":
      return e.purchase_id
        ? `This purchase was refunded to the card you paid with. The credit it gave you left your balance at ${place}.`
        : `Cashback from a refunded bill was taken back from your balance at ${place}.`;
    case "gift_out":
      return `You sent this credit to a friend with a link. It left your balance at ${place} and is theirs to spend there.`;
    case "gift_in":
      return `A friend sent you this credit. Spend it at ${place} with Pay, like credit you bought.`;
    case "gift_back":
      return `You took back a gift link nobody opened. The credit is back in your balance at ${place}.`;
    default:
      return `A movement of your credit at ${place}.`;
  }
}

/** The state word and its colour. A purchase with a refund on it reads
 *  Refunded, never as money on its way (MESITA-3753). */
function stateOf(e: WalletEntry, refunded: boolean): [string, string] {
  if (e.kind === "reversal" || refunded) return ["Refunded", "text-muted-foreground"];
  if (e.kind === "gift_out") return [e.pending ? "Sent · pending" : "Sent", "text-foreground"];
  if (e.kind === "gift_back") return ["Back in your balance", "text-green-700"];
  if (e.pending)
    return [e.available_at ? `Pending · available ${when(e.available_at)}` : "Pending", "text-foreground"];
  return [e.kind === "gift_in" ? "Received · available" : "Available", "text-green-700"];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="text-muted-foreground type-eyebrow mb-2">{title}</h2>
      <div className="bg-card border-border divide-border divide-y overflow-hidden rounded-2xl border">{children}</div>
    </section>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3">
      <span className={cn("text-sm", strong ? "font-semibold" : "text-muted-foreground")}>{label}</span>
      <span className={cn("text-right text-base tabular-nums", strong ? "font-semibold" : "font-medium")}>{value}</span>
    </div>
  );
}

const BUTTON =
  "border-border bg-card hover:bg-muted/60 flex h-11 flex-1 items-center justify-center rounded-full border text-sm font-semibold transition";

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
        <CreditEntrySkeleton />
      );
    }
    const b = wallet.data.balances.find((x) => x.place_id === placeId);
    const [kind, ms] = entryKey.split(".");
    const e = b?.entries.find((x) => x.kind === kind && String(Date.parse(x.at)) === ms);
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
    // The bonus written with this purchase: by its purchase when the read
    // carries one, else by the same instant.
    const bonus = BOUGHT.has(e.kind)
      ? b.entries.find((x) => x.kind === "bonus" && (e.purchase_id ? x.purchase_id === e.purchase_id : x.at === e.at))
      : undefined;
    const refund = BOUGHT.has(e.kind) && e.purchase_id
      ? b.entries.find((x) => x.kind === "reversal" && x.purchase_id === e.purchase_id)
      : undefined;
    const [state, tone] = stateOf(e, refund !== undefined);
    const canGift = wallet.data.can_send === true && b.spendable_cents > 0;
    return (
      <div className="flex flex-col gap-6 pb-4" data-credit-entry>
        <header>
          <h1 className="text-lg font-semibold">{place}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">{when(e.at)}</p>
          <p className="font-display mt-4 text-4xl font-semibold tracking-tight tabular-nums">
            {e.kind === "gift_out" || e.kind === "reversal" ? `−${m(amount)}` : m(amount)}
          </p>
          <p className={cn("mt-1 text-sm font-semibold", tone)}>{state}</p>
        </header>

        <Section title="What this is">
          <p className="px-4 py-3 text-sm leading-relaxed">{explain(e, place, refund !== undefined)}</p>
        </Section>

        <Section title="Details">
          <Line label="Type" value={entryLabel(e)} />
          <Line label="Amount" value={m(amount)} />
          {bonus ? <Line label="Bonus" value={`+${m(bonus.amount_cents)}`} /> : null}
          {bonus ? <Line label="Total credit" value={m(amount + bonus.amount_cents)} strong /> : null}
          <Line label="Date" value={when(e.at)} />
          <Line label="State" value={state} />
          {refund ? <Line label="Refunded on" value={when(refund.at)} /> : null}
          {e.purchase_id ? <Line label="Purchase number" value={e.purchase_id.slice(0, 8).toUpperCase()} /> : null}
          {wallet.data.test_mode ? <Line label="Test payment" value="No real money" /> : null}
        </Section>

        <Section title={`At ${place}`}>
          <Line label="Available" value={m(b.available_cents)} />
          {b.pending_cents > 0 ? <Line label="Pending" value={m(b.pending_cents)} /> : null}
          <Line label="You can spend now" value={m(b.spendable_cents)} strong />
        </Section>

        <div className="flex flex-wrap gap-2">
          <Link href={walletPlacePath(placeId)} className={BUTTON}>
            Open the House Card
          </Link>
          {b.spendable_cents > 0 ? (
            <Link href={payPlacePath(placeId)} className={BUTTON}>
              Pay here
            </Link>
          ) : null}
          {canGift ? (
            <Link href={`${walletPlacePath(placeId)}?gift=1`} className={BUTTON}>
              Gift credit
            </Link>
          ) : null}
        </div>
      </div>
    );
  })();

  return <Screen title="Credit">{body}</Screen>;
}

export function CreditEntrySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-36" />
        <Skeleton className="mt-4 h-10 w-40" />
        <Skeleton className="mt-2 h-4 w-24" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}
