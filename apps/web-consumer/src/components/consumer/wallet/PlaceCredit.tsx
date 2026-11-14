"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Gift, Plus, QrCode } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { SizedImg, voucherOffers, type PlaceActions, type PlaceMoney, type VoucherKey } from "@mesita/place-profile";
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
import { creditEntryPath, payPlacePath, payReceiptPath } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { countdownLabel, nextAvailableMs, shouldReread } from "@/lib/wallet-countdown";
import { type EntryGroup, groupKeys, splitEntries } from "@/lib/wallet-entries";
import { cn } from "@/lib/utils";
import { type Method, MethodSheet } from "./MethodSheet";
import { SendCreditSheet, SentLinks } from "./SendCredit";
import { WalletList } from "./WalletLists";
import { ACTION, ACTION_FILLED, PRIMARY, SECONDARY } from "./wallet-buttons";
import { cardAmount, giftAction } from "@/lib/wallet-card";
import { toast } from "@/lib/toast";
import type { CreditRow } from "./use-wallet";

// A PLACE'S HOUSE CARD, /wallet/<placeId> (MESITA-3741). Since MESITA-3868
// (Pato, 2026-11-14, over a screenshot: "the buttons there floting feels
// weird ... the voycher catalog there feels weird. maybe a button to add
// funds opens that catalog, not directly ... on top of transactions mention
// the pending vouchers ... must feel like Apple Wallet like super clean and
// minimalsitc") the page reads: the card, what I can do, what happened.
// Nothing is fixed over the content. Top to bottom:
//
//   [mini House Card]     half the column, centred (MESITA-3802): the
//                         place's photo and name, the server's amount (a
//                         muted $0 when nothing is spendable yet), "House Card"
//   [Pay][Buy Credits][Gift]   one row IN the page, 64px, an icon over its
//                         label. One is filled pink: Pay, or Buy Credits on
//                         an empty card. Gift follows giftAction (hidden,
//                         dimmed with a reason, or open)
//   (held-credit line)    only while an open payment holds credit
//   (Confirming a payment…)  only while the server is still confirming one
//   Transactions          ONE list: Story vouchers waiting for staff ("Not
//                         activated · show the QR to staff"), then purchases
//                         not Available yet, soonest first ("Pending ·
//                         available in 25 min"), then every settled in and
//                         out, newest first; 10 settled rows, then Show all
//   Waiting for a friend  links nobody took yet
//   View place · Remove from Wallet   two quiet links, last
//
// History of the three things this undid, each Pato's own ask at the time:
// the actions were a bar fixed at the bottom (MESITA-3790, "the buttons fixed
// at the bottom"), all three pink (MESITA-3802, "put colors to this stupid
// buttons"); the six vouchers were a list on the page (MESITA-3822, "where
// the fuck is the list of Vouchers"); pending credit was its own "Pending
// Vouchers" list over "Transactions History" (MESITA-3750).
//
// BUY CREDITS opens the place's vouchers in a sheet (BuyCreditsSheet): a tap
// closes it and opens the pay sheet the place's Offers use. The offer is read
// in the background when the page opens; the page itself paints from the
// Wallet read alone.
//
// Rows come from lib/wallet-entries.ts: a voucher and its bonus are one row
// (the only sum here, display only, both amounts the server's); a purchase
// refunded before it landed is a settled row reading "Refunded", never money
// on its way: a row is drawn as waiting only when it comes from the pending
// list. A bill opens its receipt; a purchase, its refund, a lone bonus and a
// gift open their own page (MESITA-3753); a Story row opens its QR. Every row
// that opens something ends in a chevron. Every amount is the server's
// (consumer-web-get-wallet); this screen formats, never adds.
//
// MESITA-3549: a pending row counts down to its own `available_at`, one 30 s
// tick per screen; once the soonest one passes (+5 s) the Wallet reads again.
// MESITA-3750: while a row still reads "available soon", each tick asks for
// one more read, at most 3 per stuck moment (shouldReread), then stops.

/** One tick per open House Card. */
const TICK_MS = 30_000;
/** The server turns an entry Available on its own clock: ask a little after. */
const REREAD_SLACK_MS = 5_000;
/** Settled rows before "Show all". */
const HISTORY_FIRST = 10;
/** How long the Buy Credits sheet shows skeletons before it says the offer
 *  could not load (the place screen's first-reads cap, MESITA-3803). */
const OFFER_CAP_MS = 3_000;

const ROW = "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left";

/** A waiting purchase's grey line: its own time. */
function pendingLine(g: EntryGroup, now: number): string {
  const label = countdownLabel(g.available_at, now);
  if (!label) return "Pending";
  return label.startsWith("in ") ? `Pending · available ${label}` : "Pending · available soon";
}

/** The rows with a page of their own besides a paid bill (MESITA-3753): a
 *  purchase, its refund, a lone bonus, a gift. The kinds Me › Tickets opens. */
const CREDIT_PAGE = new Set(["prepay", "voucher", "bonus", "gift_out", "gift_in", "gift_back"]);

/** Where a row opens: a paid bill's receipt, a credit movement's page, or
 *  nothing (cashback, a bill's refund: their bill's row is the receipt). */
function entryHref(placeId: string, g: EntryGroup): string | null {
  if (g.kind === "spend") return g.payment_id ? payReceiptPath(g.payment_id) : null;
  if (CREDIT_PAGE.has(g.kind) || (g.kind === "reversal" && g.purchase_id)) return creditEntryPath(placeId, g);
  return null;
}

/** A row's two lines and its amount; a waiting row mutes only the amount. */
function RowBody({ title, line, amount, waiting }: { title: string; line: string; amount: string; waiting: boolean }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{title}</span>
        <span className="text-muted-foreground mt-0.5 block text-sm">{line}</span>
      </span>
      <span className={cn("shrink-0 text-base font-semibold tabular-nums", waiting && "text-muted-foreground")}>{amount}</span>
    </>
  );
}

/** A row: what happened, its grey line, how much. `waiting` comes from the
 *  list the row is in (pending), never from the entry's own flag. */
function EntryRow({
  group,
  placeId,
  currency,
  now,
  waiting,
}: {
  group: EntryGroup;
  placeId: string;
  currency: string;
  now: number;
  waiting: boolean;
}) {
  const when = waiting ? pendingLine(group, now) : group.refunded ? "Refunded" : entryDate(group.at);
  const line = group.bonus_cents ? `${when} · includes ${money(group.bonus_cents, currency)} bonus` : when;
  const amount = `${group.amount_cents > 0 ? "+" : ""}${money(group.amount_cents, currency)}`;
  const body = <RowBody title={entryLabel(group)} line={line} amount={amount} waiting={waiting} />;
  const href = entryHref(placeId, group);
  return href ? (
    <PushLink href={href} className={cn(ROW, "hover:bg-muted/60 transition")} data-house-card-entry={group.kind}>
      {body}
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
    </PushLink>
  ) : (
    <div className={ROW}>{body}</div>
  );
}

/** A Story voucher waiting for staff, in the list's own row shape: the one
 *  row that needs the guest to act, so its line says how. */
function StoryEntryRow({ story, onOpen }: { story: WaitingStory; onOpen: () => void }) {
  const amount = `+${money(story.credit_cents, story.currency)}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(ROW, "hover:bg-muted/60 transition")}
      aria-label={`Story voucher, ${amount}, not activated. Show the QR to staff`}
      data-house-card-story
    >
      <RowBody title="Story voucher" line="Not activated · show the QR to staff" amount={amount} waiting />
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
    </button>
  );
}

/** The page loading: the mini House Card, the three actions, the list. */
export function HouseCardSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden>
      <Skeleton className="mx-auto aspect-[1.586] w-1/2 rounded-xl" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-16 flex-1 rounded-xl" />
        <Skeleton className="h-16 flex-1 rounded-xl" />
        <Skeleton className="h-16 flex-1 rounded-xl" />
      </div>
      <Skeleton className="mt-5 h-5 w-28 rounded-md" />
      <Skeleton className="mt-2 h-64 w-full rounded-2xl" />
    </div>
  );
}

/** The House Card's vouchers: list-vouchers' offer and how its read went,
 *  the guest (for the VIP and Story locks), and the buy the place's Offers
 *  use. */
export type HouseCardVouchers = {
  money: PlaceMoney | null;
  /** list-vouchers has not answered yet. */
  loading: boolean;
  /** The last list-vouchers failed. */
  failed: boolean;
  /** Ask list-vouchers again; resolves once it answered or failed. */
  onRetry: () => Promise<void>;
  guest?: PlaceActions["guest"];
  buying: VoucherKey | null;
  onBuy: (key: VoucherKey) => void;
};

/** The six vouchers as bare rows: the voucher's chip, its name, "Pay · Get".
 *  A row this guest can buy picks it; one they can't is dimmed and says why.
 *  The words and the rules are place-profile's (voucherOffers). */
function VoucherRows({
  offer,
  guest,
  busy,
  onPick,
}: {
  offer: PlaceMoney;
  guest?: PlaceActions["guest"];
  busy: boolean;
  onPick: (key: VoucherKey) => void;
}) {
  const offers = voucherOffers(offer, guest);
  const row = "flex min-h-16 w-full items-center gap-3 py-2.5 text-left";
  return (
    <ul role="list" className="divide-border divide-y">
      {offers.map((o) => {
        const body = (
          <>
            <span
              className={cn(
                "flex h-10 w-[58px] shrink-0 items-center justify-center rounded-xl text-base font-extrabold tracking-tight tabular-nums",
                o.chipClass,
              )}
              aria-hidden
            >
              {o.bonus}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold">{o.title}</span>
              <span className="text-muted-foreground mt-0.5 block text-sm tabular-nums">
                {o.buyable || !o.why ? `Pay ${o.pay} · Get ${o.get}` : o.why}
              </span>
            </span>
            {o.buyable ? <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden /> : null}
          </>
        );
        return (
          <li key={o.key}>
            {o.buyable ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(o.key)}
                className={cn(row, "hover:bg-muted/60 transition disabled:opacity-60")}
                aria-label={`${o.title}: pay ${o.pay}, get ${o.get}`}
                data-house-card-voucher={o.key}
              >
                {body}
              </button>
            ) : (
              <div className={cn(row, o.dimmed && "opacity-50")} data-house-card-voucher={o.key}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** BUY CREDITS (MESITA-3868): the place's vouchers in the app's one
 *  semi-modal. Four faces, in this order of precedence:
 *
 *    asking, inside the cap       skeleton rows
 *    failed, or the cap ran out   "Couldn't load the vouchers." + Try again
 *    answered with no offer       "This place isn't selling vouchers right now."
 *    an offer                     the rows
 *
 *  The sheet owns the cap (OFFER_CAP_MS from when it is open and unanswered)
 *  and its own "asking again" state, so Try again shows skeletons again; an
 *  answer that arrives after the cap replaces the line with the rows. State
 *  is set in callbacks only (Next 16 lint). A tap closes the sheet and hands
 *  the voucher to `onBuy`, whose pay sheet then opens. */
function BuyCreditsSheet({ open, onClose, vouchers }: { open: boolean; onClose: () => void; vouchers: HouseCardVouchers }) {
  const [retrying, setRetrying] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const asking = vouchers.loading || retrying;

  useEffect(() => {
    if (!open || !asking) return;
    const cap = setTimeout(() => setTimedOut(true), OFFER_CAP_MS);
    return () => clearTimeout(cap);
  }, [open, asking]);

  const close = () => {
    setTimedOut(false);
    onClose();
  };
  const retry = () => {
    setTimedOut(false);
    setRetrying(true);
    void vouchers.onRetry().finally(() => setRetrying(false));
  };

  const face = asking
    ? timedOut ? "failed" : "asking"
    : vouchers.failed ? "failed"
    : vouchers.money ? "rows" : "none";

  return (
    <LocalSheet open={open} onClose={close} ariaLabel="Buy Credits">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-5 pb-8" data-house-card-buy={face}>
        <h2 className="font-display text-xl font-semibold tracking-tight">Buy Credits</h2>
        <div className="mt-2">
          {face === "asking" ? (
            <div className="divide-border divide-y" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex min-h-16 items-center gap-3 py-2.5" aria-hidden>
                  <Skeleton className="h-10 w-[58px] rounded-xl" />
                  <span className="flex-1">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="mt-1.5 h-3 w-44" />
                  </span>
                </div>
              ))}
            </div>
          ) : face === "failed" ? (
            <>
              <p className="text-muted-foreground mt-2 text-sm" role="status">
                Couldn&apos;t load the vouchers.
              </p>
              <button type="button" className={cn(SECONDARY, "mt-3 w-auto px-5")} onClick={retry}>
                Try again
              </button>
            </>
          ) : vouchers.money ? (
            <VoucherRows
              offer={vouchers.money}
              guest={vouchers.guest}
              busy={vouchers.buying !== null}
              onPick={(key) => {
                close();
                vouchers.onBuy(key);
              }}
            />
          ) : (
            <p className="text-muted-foreground mt-2 text-sm" role="status">
              This place isn&apos;t selling vouchers right now.
            </p>
          )}
        </div>
      </div>
    </LocalSheet>
  );
}

export function PlaceCredit({
  row,
  canSend,
  sentLinks,
  stories = [],
  confirming = false,
  onReread,
  onRemove,
  startGift = false,
  vouchers,
}: {
  row: CreditRow;
  /** Sending credit is open here (MESITA-3292). */
  canSend: boolean;
  /** Links sent at this place that nobody took yet. */
  sentLinks: SentLink[];
  /** Story vouchers bought here that staff have not activated yet. */
  stories?: WaitingStory[];
  /** The server is still confirming a purchase (Wallet-wide, so a line, not
   *  a row of this place's list). */
  confirming?: boolean;
  onReread?: () => void;
  onRemove?: (placeId: string) => Promise<void>;
  /** Open with Gift Credits showing (Me › Gift, MESITA-3771); only when
   *  sending is open here and there is credit to send. */
  startGift?: boolean;
  /** The place's vouchers, behind Buy Credits (MESITA-3868). */
  vouchers?: HouseCardVouchers;
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

  // A row still "available soon" on a tick: ask again, at most 3 times per
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
  const [buyOpen, setBuyOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const spendable = balance?.spendable_cents ?? 0;
  const gift = giftAction({ canSend, spendableCents: spendable, shownCents: cardAmount(card).cents });
  const changed = onReread ?? (() => {});
  // Nothing spendable yet: a muted $0, never a minus (a refund can settle
  // before the purchase it refunds lands).
  const muted = card.available_cents <= 0;
  const amount = money(Math.max(0, card.available_cents), card.currency);
  // AN EMPTY CARD, one boolean: nothing spendable, nothing pending, no entry
  // and no Story voucher waiting. It moves the pink to Buy Credits and shows
  // "No transactions yet"; a card with a Story voucher waiting is never
  // removable from here.
  const empty =
    card.available_cents <= 0 && card.pending_cents <= 0 && (entries?.length ?? 0) === 0 && stories.length === 0;
  const removable = onRemove !== undefined && stories.length === 0 && canRemoveHouseCard(balance);
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
        className="relative mx-auto aspect-[1.586] w-1/2 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[var(--brand-pink-500)] to-[var(--brand-pink-800)] p-3 text-white shadow-md"
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
      {gone ? (
        <p className="text-muted-foreground mt-5 text-sm" data-house-card-gone>
          Your credit here stays yours; ask Mesita support to use it.
        </p>
      ) : (
        /* THE ACTIONS, IN THE PAGE (MESITA-3868): one row under the card that
           scrolls with it; the bar's Pay tab stays one tap away further down.
           One filled button: Pay, or Buy Credits on an empty card. */
        <div className="mt-5 flex gap-2" data-house-card-actions>
          <PushLink
            href={payPlacePath(row.placeId)}
            className={empty && vouchers ? ACTION : ACTION_FILLED}
            data-house-card-pay
          >
            <QrCode className="h-5 w-5" aria-hidden />
            Pay
          </PushLink>
          {vouchers ? (
            <button
              type="button"
              className={empty ? ACTION_FILLED : ACTION}
              onClick={() => setBuyOpen(true)}
              data-house-card-fund
            >
              <Plus className="h-5 w-5" aria-hidden />
              Buy Credits
            </button>
          ) : null}
          {gift ? (
            <button
              type="button"
              className={cn(ACTION, gift !== "open" && "opacity-50")}
              onClick={() => (gift === "open" ? setSending(true) : toast(gift.blocked))}
              aria-label={gift === "open" ? "Gift Credits" : `Gift Credits: ${gift.blocked}`}
              data-send-credit-open
            >
              <Gift className="h-5 w-5" aria-hidden />
              Gift
            </button>
          ) : null}
        </div>
      )}
      {held ? (
        <p className="text-muted-foreground mt-5 text-sm" data-house-card-held>
          Some credit is held by an open payment. It returns when that payment finishes or expires.
        </p>
      ) : null}
      {confirming ? (
        <p className="text-muted-foreground mt-5 -mb-2 text-sm" role="status" data-house-card-confirming>
          Confirming a payment…
        </p>
      ) : null}

      <WalletList
        title="Transactions"
        fallback={
          <p className="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-4 text-sm" data-house-card-history-empty>
            No transactions yet
          </p>
        }
      >
        {stories.map((st) => (
          <StoryEntryRow key={st.purchase_id} story={st} onOpen={() => setMethod({ kind: "story", story: st })} />
        ))}
        {pending.map((g, i) => (
          <EntryRow key={`w-${pendingKeys[i]}`} group={g} placeId={row.placeId} currency={card.currency} now={now} waiting />
        ))}
        {shownHistory.map((g, i) => (
          <EntryRow key={historyKeys[i]} group={g} placeId={row.placeId} currency={card.currency} now={now} waiting={false} />
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

      <SentLinks links={sentLinks} currency={card.currency} onChanged={changed} />

      {/* TWO QUIET LINKS, LAST: the place's profile (a place gone from Mesita
          has no page) and Remove from Wallet (MESITA-3605: only a card the
          guest pinned that holds nothing and has no history; one short
          confirm, then the server checks the money again, 409 has_credit). */}
      {!gone || removable ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2">
          {gone ? null : (
            <PushLink
              href={href}
              className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-0.5 px-3 text-sm transition"
              data-house-card-place
            >
              View place
              <ChevronRight className="h-4 w-4" aria-hidden />
            </PushLink>
          )}
          {removable ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground min-h-11 px-3 text-sm transition"
              onClick={() => setRemoveOpen(true)}
              data-house-card-remove
            >
              Remove from Wallet
            </button>
          ) : null}
        </div>
      ) : null}

      {vouchers && !gone ? <BuyCreditsSheet open={buyOpen} onClose={() => setBuyOpen(false)} vouchers={vouchers} /> : null}
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
      {removable ? (
        <LocalSheet open={removeOpen} onClose={() => (removing ? undefined : setRemoveOpen(false))} ariaLabel="Remove this House Card">
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
                    setRemoveOpen(false);
                  });
                }}
              >
                {removing ? "Removing…" : "Remove"}
              </button>
              <button type="button" disabled={removing} className={SECONDARY} onClick={() => setRemoveOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </LocalSheet>
      ) : null}
    </>
  );
}
