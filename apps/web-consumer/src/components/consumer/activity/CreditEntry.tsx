"use client";

// ONE CREDIT MOVEMENT, ONE PAGE: /me/tickets/credit/<placeId>/<kind>.<ms>
// (MESITA-3782, Tickets 4/10 MESITA-4004). A Vouchers, Gifts or Refunds row
// opens it, built from TicketParts like the Visit page. In boxes since
// MESITA-4118 (the Gift ticket's shape): a centred top box, then each
// section its own panel:
//
//   TicketHero       photo + badge, "+$500.00MX", its state (Available,
//                    Pending · available <date>, Refunded <date>), the place,
//                    when, the Test chip
//   Your credit      Bought · Bonus · Extra credit · Total credit (a gift or a
//                    refund: its Type)
//   Refund           the Refund ticket, when this purchase was refunded
//   At <place>       Available · Pending · You can spend now
//   Purchase         the purchase number with copy
//   Pay here (filled, when spendable) · Open the House Card (outline)
//   Gift credit      a quiet text link, when sending is allowed
//
// A gift received (MESITA-4006, Tickets 6/10) is shorter: the header reads
// Received (green) or "Pending · Available on <date>" (ink), one line "A
// friend sent you credit at <place>." (the wallet read carries no sender), the
// place's balance, and Pay here (filled) alone.
//
// A gift line forwards to its gift's own page (MESITA-4066): the read now
// carries each gift line's gift_id, and a gift_out / gift_in / gift_back
// whose gift is in the wallet's `gifts` replaces this page with
// /me/tickets/gift/<giftId> (lib/gift-ticket.ts giftOfEntry). Until then a
// sent gift's take-back was paired to a send by amount and order, which could
// swap two same-amount gifts; that pairing is gone. A gift line with no gift
// in the read (past its cap, or an older server) keeps the short page below:
// the header, one line, the place's balance, Open the House Card.
//
// A Refund page (MESITA-4011, Tickets 10/10): the top box with the amount and
// no sign, Refunded, "Refunded to the card you paid with.", a Timeline box
// (Bought, Refunded), the Refund box (credit taken back when any, the original
// purchase as a link only when its purchase_id finds it, the purchase number
// with copy) and Open the House Card (outline) alone. Found by purchase_id.
//
// A refunded purchase reads Refunded <date> and links to its Refund ticket by
// purchase_id; the purchase number has a copy button. It reads the wallet
// Tickets already holds (the same cached read); an entry it cannot find any
// more says so and goes back to Tickets.

import { creditEntryTitle } from "@/lib/credit-entry-title";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, Copy } from "lucide-react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import type { TicketRowKind } from "./ActivityRow";
import {
  PlaceMark,
  TicketActions,
  TicketHero,
  TicketLine,
  TicketPage,
  TicketPanel,
  TicketSkeleton,
  TimelinePanel,
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
import {
  creditEntryPath,
  giftTicketPath,
  payPlacePath,
  placePath,
  walletPlacePath,
  walletSendPath,
} from "@/lib/consumer-route-contract";
import { giftOfEntry } from "@/lib/gift-ticket";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { useCachedQuery } from "@/lib/use-cached-query";

const when = (iso: string) =>
  `${new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${clockTime(iso)}`;

const BOUGHT = new Set(["prepay", "voucher"]);

/** The page's entry: by kind and instant; when several share them (a
 *  purchase's reversals), the largest amount (MESITA-4004). */
function findEntry(wallet: Wallet, placeId: string, entryKey: string) {
  const b = wallet.balances.find((x) => x.place_id === placeId);
  const [kind, ms] = entryKey.split(".");
  const e = b?.entries
    .filter((x) => x.kind === kind && String(Date.parse(x.at)) === ms)
    .sort((x, y) => Math.abs(y.amount_cents) - Math.abs(x.amount_cents))[0];
  return { b, e };
}

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
  if (e.kind === "gift_in")
    return e.pending
      ? [e.available_at ? `Pending · Available on ${entryDate(e.available_at)}` : "Pending", "ink"]
      : ["Received", "green"];
  if (e.pending)
    return [e.available_at ? `Pending · available ${entryDate(e.available_at)}` : "Pending", "ink"];
  return ["Available", "green"];
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

  // A gift line whose gift the read holds is that gift's page (MESITA-4066).
  const router = useRouter();
  const found = wallet.data ? findEntry(wallet.data, placeId, entryKey).e : undefined;
  const gift = wallet.data && found ? giftOfEntry(wallet.data, found) : null;
  const forward = gift ? giftTicketPath(gift.gift_id) : null;
  useEffect(() => {
    if (forward) router.replace(forward);
  }, [forward, router]);

  const body = (() => {
    if (forward) return <TicketSkeleton />;
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
    const { b, e } = findEntry(wallet.data, placeId, entryKey);
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

    // A refunded purchase (MESITA-4011, Tickets 10/10): found by its
    // purchase_id, its largest reversal the page's entry, so two reversals at
    // one instant never swap pages. The money went back to the card: no sign.
    if (e.kind === "reversal" && e.purchase_id && !e.payment_id) {
      const pid = e.purchase_id;
      const reversals = b.entries
        .filter((x) => x.kind === "reversal" && !x.payment_id && x.purchase_id === pid)
        .sort((x, y) => Math.abs(y.amount_cents) - Math.abs(x.amount_cents));
      const refund = reversals[0] ?? e;
      const refunded = reversals.reduce((n, x) => n + Math.abs(x.amount_cents), 0) || amount;
      const original = b.entries.find((x) => BOUGHT.has(x.kind) && x.purchase_id === pid);
      const takenBack = b.entries
        .filter((x) => x.kind === "extra" && !x.payment_id && x.purchase_id === pid)
        .reduce((n, x) => n + x.amount_cents, 0);
      return (
        <TicketPage data-credit-entry>
          <TicketHero
            marks={<PlaceMark photo={b.place?.photo} kind="refund" />}
            headline={m(refunded)}
            state="Refunded"
            tone="grey"
            place={place}
            placeHref={b.place?.id ? placePath(b.place.id) : undefined}
            when={when(refund.at)}
            note="Refunded to the card you paid with."
            test={wallet.data.test_mode}
          />
          <TimelinePanel
            steps={[
              ...(original ? [{ label: "Bought", when: when(original.at), value: m(Math.abs(original.amount_cents)) }] : []),
              { label: "Refunded", when: when(refund.at), value: m(refunded) },
            ]}
          />
          <TicketPanel title="Refund">
            <TicketLine label="Refunded amount" value={m(refunded)} />
            {takenBack > 0 ? <TicketLine label="Credit taken back" value={`−${m(takenBack)}`} /> : null}
            <TicketLine label="Refunded on" value={entryDate(refund.at)} />
            {original ? (
              <TicketLine
                label="Original purchase"
                sub={when(original.at)}
                value={m(Math.abs(original.amount_cents))}
                href={creditEntryPath(placeId, original)}
              />
            ) : null}
            <TicketLine
              label="Purchase number"
              value={pid.slice(0, 8).toUpperCase()}
              trailing={<CopyPurchaseId id={pid} />}
            />
          </TicketPanel>
          <Link
            href={walletPlacePath(placeId)}
            className="border-border bg-card hover:bg-muted/60 flex h-11 items-center justify-center rounded-full border text-sm font-semibold transition"
          >
            Open the House Card
          </Link>
        </TicketPage>
      );
    }

    const bought = BOUGHT.has(e.kind);
    // The bonus written with this purchase: by its purchase when the read
    // carries one, else by the same instant.
    const bonus = bought
      ? b.entries.find((x) => x.kind === "bonus" && (e.purchase_id ? x.purchase_id === e.purchase_id : x.at === e.at))
      : undefined;
    // The legacy extra credit this purchase earned (an `extra` with its
    // purchase id and no payment id, MESITA-4003).
    const extra =
      bought && e.purchase_id
        ? b.entries
            .filter((x) => x.kind === "extra" && !x.payment_id && x.purchase_id === e.purchase_id)
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
    const received = e.kind === "gift_in";
    const given = e.kind === "gift_out" || e.kind === "gift_back";
    return (
      <TicketPage data-credit-entry>
        <TicketHero
          marks={<PlaceMark photo={b.place?.photo} kind={badgeOf(e)} />}
          headline={out ? `−${m(amount)}` : bought || e.kind === "bonus" || e.kind === "gift_in" ? `+${m(amount)}` : m(amount)}
          state={state}
          tone={tone}
          place={place}
          placeHref={b.place?.id ? placePath(b.place.id) : undefined}
          when={when(e.at)}
          note={
            received
              ? `A friend sent you credit at ${place}.`
              : given
                ? e.kind === "gift_back"
                  ? `You took back ${m(amount)} you had sent. It is in your balance at ${place}.`
                  : `You sent ${m(amount)} of your credit at ${place} to a friend.`
                : null
          }
          test={wallet.data.test_mode}
          dim={e.kind === "reversal" || refund !== undefined}
        />

        {received || given ? null : bought ? (
          <TicketPanel title="Your credit">
            <TicketLine label="Bought" value={m(amount)} />
            {bonus ? <TicketLine label="Bonus" value={`+${m(bonus.amount_cents)}`} /> : null}
            {extra > 0 ? <TicketLine label="Extra credit" value={`+${m(extra)}`} /> : null}
            {bonus || extra > 0 ? (
              <TicketLine label="Total credit" value={m(amount + (bonus?.amount_cents ?? 0) + extra)} strong />
            ) : null}
          </TicketPanel>
        ) : (
          <TicketPanel title="Details">
            <TicketLine label="Type" value={entryLabel(e)} />
          </TicketPanel>
        )}

        {refund ? (
          <TicketPanel title="Refund">
            <TicketLine
              label="Refund ticket"
              sub={when(refund.at)}
              value={m(Math.abs(refund.amount_cents))}
              href={creditEntryPath(placeId, refund)}
            />
          </TicketPanel>
        ) : null}

        <TicketPanel title={`At ${place}`}>
          <TicketLine label="Available" value={m(b.available_cents)} />
          {b.pending_cents > 0 ? <TicketLine label="Pending" value={m(b.pending_cents)} /> : null}
          <TicketLine label="You can spend now" value={m(b.spendable_cents)} strong />
        </TicketPanel>

        {e.purchase_id ? (
          <TicketPanel title="Purchase">
            <TicketLine
              label="Purchase number"
              value={e.purchase_id.slice(0, 8).toUpperCase()}
              trailing={<CopyPurchaseId id={e.purchase_id} />}
            />
          </TicketPanel>
        ) : null}

        {given ? (
          <TicketActions primary={houseCard} />
        ) : b.spendable_cents > 0 ? (
          <TicketActions
            primary={{ label: "Pay here", href: payPlacePath(placeId) }}
            secondary={received ? undefined : houseCard}
          />
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
            href={walletSendPath(placeId)}
            className="text-muted-foreground hover:text-foreground -mt-2 self-center py-2 text-sm font-medium underline-offset-4 transition hover:underline"
          >
            Gift credit
          </Link>
        ) : null}
      </TicketPage>
    );
  })();

  return <MeScreen title={creditEntryTitle(entryKey)}>{body}</MeScreen>;
}
