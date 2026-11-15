"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, CreditCard, Gift, HandCoins, QrCode } from "lucide-react";
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
import { CONSUMER_ROUTES, creditEntryPath, payPlacePath, payReceiptPath, walletSendPath } from "@/lib/consumer-route-contract";
import { placeHref } from "@/lib/place-route";
import { countdownLabel, nextAvailableMs, shouldReread } from "@/lib/wallet-countdown";
import { type EntryGroup, groupKeys, splitEntries } from "@/lib/wallet-entries";
import { cn } from "@/lib/utils";
import { type Method, MethodSheet } from "./MethodSheet";
import { SentLinks } from "./SendCredit";
import { Panel } from "@/components/shared/Panel";
import { WalletPanelList } from "./WalletLists";
import { DOOR_BUY, DOOR_GIFT, DOOR_GLYPH, DOOR_PINK, DOOR_ROW, PRIMARY, SECONDARY } from "./wallet-buttons";
import { cardAmount, giftAction } from "@/lib/wallet-card";
import { toast } from "@/lib/toast";
import type { CreditRow } from "./use-wallet";

// A PLACE'S HOUSE CARD, /wallet/place/<placeId> (MESITA-3741). Since MESITA-3868
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
//   [Buy Credits][Send Gift][Claim Gift][Go to Pay]   Wallet's four doors
//                         (MESITA-4095), 52px, icon over label; Go to Pay
//                         sits where Wallet has Share Mesita. Gift follows
//                         giftAction (hidden, dimmed with a reason, or open)
//   (held-credit line)    only while an open payment holds credit
//   (Confirming a payment…)  only while the server is still confirming one
//   Vouchers to activate  Story vouchers waiting for staff, only when any
//                         (MESITA-4116)
//   Transactions          ONE list: (until MESITA-4116 Story vouchers waiting for staff, "Not
//                         activated · show the QR to staff"), then purchases
//                         not Available yet, soonest first ("Pending ·
//                         available in 25 min"), then every settled in and
//                         out, newest first; 10 settled rows, then Show all
//   Waiting for a friend  links nobody took yet
//   View place            a grey pill under the card (MESITA-4116)
//   Remove from Wallet    one quiet link, last
//
// History of the three things this undid, each Pato's own ask at the time:
// the actions were a bar fixed at the bottom (MESITA-3790, "the buttons fixed
// at the bottom"), all three pink (MESITA-3802, "put colors to this stupid
// buttons"); the six vouchers were a list on the page (MESITA-3822, "where
// the fuck is the list of Vouchers"); pending credit was its own "Pending
// Vouchers" list over "Transactions History" (MESITA-3750).
//
// ADD CREDITS (MESITA-3883, Pato: "redirect to the place profile prepay page,
// not a quick [sheet] to open ... make it good"; "think if buy credits is the
// right naming"): a link to the place's full-screen Offers page at
// Prepayments, the one page with the (i) explanations, the basket and the
// locks. Its back returns here (`from=wallet`), and a purchase returns here
// from Stripe (MESITA-3617). Named Add, not Buy: it raises this card's
// balance, like a wallet's "Add Money" (MESITA-3705's own word); the Buy
// Credits sheet of MESITA-3868 is gone. The page paints from the Wallet read
// alone.
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

/** The place's round photo beside the page's title (Pato, 2026-11-15,
 *  MESITA-4064: "when a house card is selected, show profile picture on
 *  header"): the card's own photo, 32px; its initial without one. */
export function PlacePhotoMark({ photo, name }: { photo: string | null; name: string }) {
  return (
    <span className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold" aria-hidden>
      {photo ? <SizedImg src={photo} size="thumb" alt="" className="h-full w-full object-cover" /> : (name ?? "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** The page loading: the card's panel, then the Transactions panel. */
export function HouseCardSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden>
      <Panel className="mt-4 p-4">
        <Skeleton className="mx-auto aspect-[1.586] w-1/2 rounded-xl" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-16 flex-1 rounded-xl" />
          <Skeleton className="h-16 flex-1 rounded-xl" />
          <Skeleton className="h-16 flex-1 rounded-xl" />
        </div>
      </Panel>
      <Panel className="mt-4 p-4">
        <Skeleton className="h-5 w-28 rounded-md" />
        <Skeleton className="mt-3 h-48 w-full rounded-xl" />
      </Panel>
    </div>
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
  // A card with a Story voucher waiting is never removable from here.
  const removable = onRemove !== undefined && stories.length === 0 && canRemoveHouseCard(balance);
  const pendingKeys = groupKeys(pending);
  const shownHistory = allHistory ? history : history.slice(0, HISTORY_FIRST);
  const historyKeys = groupKeys(shownHistory);
  return (
    <>
      {/* EACH SECTION A PANEL (Pato, 2026-11-15, MESITA-4064: "each section
          in body must be in a box or something for more clarity. make a
          cleaner UI"): the card and what it can do, Transactions, Waiting
          for a friend, each one Panel (MESITA-4063's, shared since MESITA-4071), 16px apart. */}
      <Panel className="mt-4 p-4" data-house-card-panel>
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
      {/* VIEW PLACE AT THE TOP (MESITA-4116, Pato: "add the view place as a
          button at the top, not at the bottom hidden"): a quiet grey pill
          under the card, the outbound-link style. */}
      {gone ? null : (
        <PushLink
          href={href}
          className="bg-muted text-foreground hover:bg-border mx-auto mt-3 flex h-9 items-center gap-1 rounded-full px-4 text-sm font-semibold transition"
          data-house-card-place
        >
          View place
          <ChevronRight className="h-4 w-4" aria-hidden />
        </PushLink>
      )}
      {gone ? (
        <p className="text-muted-foreground mt-4 text-sm" data-house-card-gone>
          Your credit here stays yours; ask Mesita support to use it.
        </p>
      ) : (
        /* THE ACTIONS, IN THE PAGE (MESITA-3868): one row under the card that
           scrolls with it. Wallet's four doors since MESITA-4095 (Pato: "the
           same 4 buttons, the same sizes, but instead of saying share mesita,
           mention go to pay"): Buy · Send Gift · Claim Gift · Go to Pay. */
        <div className={`mt-4 ${DOOR_ROW}`} data-house-card-actions>
          <PushLink href={`${href}?rewards=prepayment&from=wallet`} className={DOOR_BUY} data-house-card-fund>
            <CreditCard className={DOOR_GLYPH} strokeWidth={2.25} aria-hidden />
            Buy Credits
          </PushLink>
          {/* Send Gift is its own page (MESITA-4096); it was a sheet here. */}
          {gift === "open" ? (
            <PushLink href={walletSendPath(row.placeId)} className={DOOR_GIFT} data-send-credit-open>
              <Gift className={DOOR_GLYPH} strokeWidth={2.25} aria-hidden />
              Send Gift
            </PushLink>
          ) : gift ? (
            <button
              type="button"
              className={cn(DOOR_GIFT, "opacity-50")}
              onClick={() => toast(gift.blocked)}
              aria-label={`Send Gift: ${gift.blocked}`}
              data-send-credit-open
            >
              <Gift className={DOOR_GLYPH} strokeWidth={2.25} aria-hidden />
              Send Gift
            </button>
          ) : null}
          <PushLink href={CONSUMER_ROUTES.walletRedeem} className={DOOR_GIFT} data-house-card-claim>
            <HandCoins className={DOOR_GLYPH} strokeWidth={2.25} aria-hidden />
            Claim Gift
          </PushLink>
          <PushLink href={payPlacePath(row.placeId)} className={DOOR_PINK} data-house-card-pay>
            <QrCode className={DOOR_GLYPH} strokeWidth={2.25} aria-hidden />
            Go to Pay
          </PushLink>
        </div>
      )}
      {held ? (
        <p className="text-muted-foreground mt-4 text-sm" data-house-card-held>
          Some credit is held by an open payment. It returns when that payment finishes or expires.
        </p>
      ) : null}
      </Panel>
      {confirming ? (
        <p className="text-muted-foreground mt-4 text-sm" role="status" data-house-card-confirming>
          Confirming a payment…
        </p>
      ) : null}

      {/* VOUCHERS TO ACTIVATE (MESITA-4116, Pato: "also add a list of
          vouchers pending to activate if it's the case"): Story vouchers
          waiting for staff get their own panel over Transactions, only when
          there are any. */}
      {stories.length > 0 ? (
        <WalletPanelList title="Vouchers to activate">
          {stories.map((st) => (
            <StoryEntryRow key={st.purchase_id} story={st} onOpen={() => setMethod({ kind: "story", story: st })} />
          ))}
        </WalletPanelList>
      ) : null}

      <WalletPanelList
        title="Transactions"
        fallback={
          <p className="text-muted-foreground text-sm" data-house-card-history-empty>
            No transactions yet
          </p>
        }
      >
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
      </WalletPanelList>

      <SentLinks links={sentLinks} currency={card.currency} onChanged={changed} />

      {/* ONE QUIET LINK, LAST: Remove from Wallet (MESITA-3605: only a card the
          guest pinned that holds nothing and has no history; one short
          confirm, then the server checks the money again, 409 has_credit). */}
      {removable ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2">
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
