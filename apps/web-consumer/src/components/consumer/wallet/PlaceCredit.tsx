"use client";


import { useEffect, useMemo, useRef, useState } from "react";
import { BadgePercent, ChevronRight, Clock3, Gift, QrCode, Store } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { offerSlides, SizedImg } from "@mesita/place-profile";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { Skeleton } from "@/components/shared/Skeleton";
import { canRemoveLoyaltyCard, money } from "@/lib/api/wallet";
import { creditEntryPath, payCodePath, payReceiptPath, walletSendPath } from "@/lib/consumer-route-contract";
import { useRouter } from "next/navigation";
import { navigateTo } from "@/lib/navigate";
import { placeHref } from "@/lib/place-route";
import { nextAvailableMs, shouldReread } from "@/lib/wallet-countdown";
import { type EntryGroup, groupKeys, splitEntries } from "@/lib/wallet-entries";
import { cn } from "@/lib/utils";
import { Panel, PANEL_CLASS } from "@/components/shared/Panel";
import { PendingBox, pendingWords } from "./WalletLists";
import { TicketsBoard, type TicketTab } from "@/components/consumer/activity/MeLists";
import { ActivityRowsSkeleton } from "@/components/consumer/activity/ActivityRow";
import { PRIMARY, SECONDARY } from "./wallet-buttons";
import { offerHref } from "@/components/consumer/offer-button";
import { cardAmount, giftAction } from "@/lib/wallet-card";
import { OffersTile } from "@mesita/place-profile";
import { toast } from "@/lib/toast";
import type { CreditRow } from "./use-wallet";

/** THE BANK ROW (MESITA-4281, Pato picked drawing A: "the four buttons like
 *  that look like shit"): four round 52px faces with the label under,
 *  the banking-app look. Only Pay Bill has colour (Stripe purple). */
const ROUND =
  "flex w-18 flex-col items-center gap-1.5 text-center text-xs leading-tight font-semibold text-white outline-none transition active:scale-[0.97] focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-neutral-400";
const ROUND_FACE = "relative flex h-13 w-13 items-center justify-center rounded-full";
const ROUND_GLYPH = "h-5 w-5";

// A PLACE'S LOYALTY CARD, /wallet/place/<placeId> (MESITA-3741). Since MESITA-3868
// (Pato, 2026-11-14, over a screenshot: "the buttons there floting feels
// weird ... the voycher catalog there feels weird. maybe a button to add
// funds opens that catalog, not directly ... on top of transactions mention
// the pending vouchers ... must feel like Apple Wallet like super clean and
// minimalsitc") the page reads: the card, what I can do, what happened.
// Nothing is fixed over the content. Top to bottom:
//
//   [mini Loyalty Card]     half the column, centred (MESITA-3802): the
//                         place's photo and name, the server's amount (a
//                         muted $0 when nothing is spendable yet), "Loyalty Card"
//   (Prepay)(Pay Bill)(Send Gift)(View Place)  four round buttons, label
//                         under (MESITA-4281); only Pay Bill purple; Add Funds
//                         wears a +N% chip and hides when nothing is for sale;
//                         Send Gift follows giftAction (hidden, dimmed, open)
//   (held-credit line)    only while an open payment holds credit
//   (Confirming a payment…)  only while the server is still confirming one
//   Pending               purchases not Available yet, soonest first
//                         ("Pending · available in 25 min"), only when any
//   Tickets               this place's Tickets, Me › Tickets' pills and rows
//                         (MESITA-4279; a "Transactions" ledger before)
//   Waiting for a friend  links nobody took yet
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
// gift open their own page (MESITA-3753). Every row
// that opens something ends in a chevron. Every amount is the server's
// (consumer-web-get-wallet); this screen formats, never adds.
//
// MESITA-3549: a pending row counts down to its own `available_at`, one 30 s
// tick per screen; once the soonest one passes (+5 s) the Wallet reads again.
// MESITA-3750: while a row still reads "available soon", each tick asks for
// one more read, at most 3 per stuck moment (shouldReread), then stops.

/** One tick per open Loyalty Card. */
const TICK_MS = 30_000;
/** The server turns an entry Available on its own clock: ask a little after. */
const REREAD_SLACK_MS = 5_000;

/** The rows with a page of their own besides a paid bill (MESITA-3753): a
 *  purchase, its refund, a lone bonus, a gift. The kinds Me › Tickets opens. */
const CREDIT_PAGE = new Set(["prepay", "voucher", "bonus", "gift_out", "gift_in", "gift_back"]);

/** Where a row opens: a paid bill's receipt, a credit movement's page, or
 *  nothing (extra credit, a bill's refund: their bill's row is the receipt). */
function entryHref(placeId: string, g: EntryGroup): string | null {
  if (g.kind === "spend") return g.payment_id ? payReceiptPath(g.payment_id) : null;
  if (CREDIT_PAGE.has(g.kind) || (g.kind === "reversal" && g.purchase_id)) return creditEntryPath(placeId, g);
  return null;
}

/** The place's round photo beside the page's title (Pato, 2026-11-15,
 *  MESITA-4064: "when a loyalty card is selected, show profile picture on
 *  header"): the card's own photo, 32px; its initial without one. */
export function PlacePhotoMark({ photo, name }: { photo: string | null; name: string }) {
  return (
    <span className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold" aria-hidden>
      {photo ? <SizedImg src={photo} size="thumb" alt="" className="h-full w-full object-cover" /> : (name ?? "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** The header's place while the card is unread (MESITA-4351, Pato: "the
 *  placeholder saying wallet on top is just wrong"): a round photo bone and
 *  a name bar, the route's loading.tsx and the screen alike. */
export function PlaceTitleBones() {
  return (
    <span className="flex items-center gap-2" aria-hidden>
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="h-5 w-40 rounded-md" />
    </span>
  );
}

/** The page loading: the card's panel, then the Tickets list. */
export function LoyaltyCardSkeleton() {
  // NO WORDS, THE PAGE'S SHAPE (MESITA-4332, Pato: "the loading must be
  // placeholder with no words"): the card panel (the card, four round
  // actions with their label bars), then the hairline, the Tickets strip's
  // four tabs and the list box, as the page draws them.
  return (
    <div className="flex flex-col" aria-hidden>
      <Panel className="bg-foreground mt-4 border-transparent p-5">
        <div className="mx-auto aspect-[1.586] w-4/5 rounded-2xl bg-white/10" />
        <div className="mt-5 grid grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="flex flex-col items-center gap-2">
              <span className="h-13 w-13 rounded-full bg-white/25" />
              <span className="h-3 w-14 rounded-md bg-white/10" />
            </span>
          ))}
        </div>
      </Panel>
      <Skeleton className="mt-4 h-16 w-full rounded-2xl" />
      <div className={cn(PANEL_CLASS, "mt-4")}>
        <div className="border-border grid grid-cols-4 border-b">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="flex justify-center py-3.5">
              <Skeleton className="h-3.5 w-16 rounded-md" />
            </span>
          ))}
        </div>
        <div className="[&_[aria-busy]]:rounded-none [&_[aria-busy]]:border-0">
          <ActivityRowsSkeleton />
        </div>
      </div>
    </div>
  );
}

export function PlaceCredit({
  row,
  canSend,
  confirming = false,
  onReread,
  onRemove,
}: {
  row: CreditRow;
  /** Sending credit is open here (MESITA-3292). */
  canSend: boolean;
  /** The server is still confirming a purchase (Wallet-wide, so a line, not
   *  a row of this place's list). */
  confirming?: boolean;
  onReread?: () => void;
  onRemove?: (placeId: string) => Promise<void>;
}) {
  const { card, balance } = row;
  const href = placeHref(row.placeSlug);
  const offers = useMemo(() => offerSlides(balance?.offers), [balance?.offers]);
  const prepay = offers.find((o) => o.key === "prepay");
  // A balance whose place the server could not name: gone from Mesita.
  const gone = balance !== null && balance.place === null;
  const held = balance !== null && balance.spendable_cents < balance.available_cents;
  const entries = balance?.entries;
  const { pending } = splitEntries(entries ?? []);
  const counting = pending.some((g) => g.available_at);
  const [now, setNow] = useState(() => Date.now());
  const [ticketKind, setTicketKind] = useState<TicketTab>("visits");

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
  const router = useRouter();
  const spendable = balance?.spendable_cents ?? 0;
  const gift = giftAction({ canSend, spendableCents: spendable, shownCents: cardAmount(card).cents });
  // Nothing spendable yet: a muted $0, never a minus (a refund can settle
  // before the purchase it refunds lands).
  const muted = card.available_cents <= 0;
  const amount = money(Math.max(0, card.available_cents), card.currency);
  // ON ITS WAY, ON THE CARD (MESITA-4321, Pato: "the card view here must
  // also express both current credits and pending credits … no time to
  // land, just pending"): money still landing here (the server's pending,
  // a bonus's 3 hours).
  const comingCents = Math.max(0, balance?.pending_cents ?? 0);
  const coming = comingCents > 0 ? `+${money(comingCents, card.currency)} pending` : null;
  const removable = onRemove !== undefined && canRemoveLoyaltyCard(balance);
  const pendingKeys = groupKeys(pending);
  return (
    <>
      {/* EACH SECTION A PANEL (Pato, 2026-11-15, MESITA-4064: "each section
          in body must be in a box or something for more clarity. make a
          cleaner UI"): the card and what it can do, Tickets, Waiting
          for a friend, each one Panel (MESITA-4063's, shared since MESITA-4071), 16px apart. */}
      {/* THE DARK TOP BOX (MESITA-4353, Pato: "this box containing card and
          4 buttons must have a dark background … top box with bottom box"):
          near-black, the card on it, white labels; the Tickets get their
          own white box under it. LIGHT BUTTONS ON DARK (MESITA-4356, Pato:
          "buttons must be light if the background is dark, but keep the
          purple purple"): white circles with ink icons; Pay Bill purple. */}
      <Panel className="bg-foreground mt-4 border-transparent p-5" data-loyalty-card-panel>
      {/* THE MINI LOYALTY CARD (MESITA-3802, Pato: "instead of that ugly pink
          box display mini Loyalty Card, not occupying full width of screen,
          only 50% of screen. card must display amount of credits, name, and
          profile picture"): a card-shaped pink gradient, half the column,
          centred; the place's photo and name, the amount, "Loyalty Card". A $0
          is white at reduced opacity, never grey on pink. */}
      {/* A BANK CARD (MESITA-4353, Pato: "update the design of the card"):
          Mesita pink with a soft diagonal sheen, the place at the top left
          and "Mesita" at the top right, the amount, the pending line and
          "Loyalty Card" stacked at the bottom left; 80% of the box. */}
      <div
        role="img"
        aria-label={`Loyalty Card, ${card.name}, ${amount} available${coming ? `, ${coming}` : ""}`}
        className="relative mx-auto flex aspect-[1.586] w-4/5 shrink-0 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-pink-500)] to-[var(--brand-pink-800)] p-4 text-white shadow-lg"
        data-loyalty-card-amounts
      >
        <span
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgb(255_255_255/0.14)_50%,transparent_65%)]"
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-2" aria-hidden>
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/20 type-label font-semibold">
              {card.photo ? (
                <SizedImg src={card.photo} size="thumb" alt="" className="h-full w-full object-cover" />
              ) : (
                (card.name ?? "?").trim().charAt(0).toUpperCase()
              )}
            </span>
            <span className="line-clamp-2 min-w-0 text-sm leading-tight font-semibold">{card.name}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold tracking-tight text-white/80">Mesita</span>
        </div>
        <div className="relative flex flex-col items-start" aria-hidden>
          <span className={cn("text-3xl leading-tight font-semibold tabular-nums", muted && "text-white/70")}>{amount}</span>
          {coming ? (
            <span className="text-sm font-semibold text-white/80 tabular-nums" data-loyalty-card-pending>
              {coming}
            </span>
          ) : null}
          <span className="type-eyebrow mt-1 text-white/70">Loyalty Card</span>
        </div>
      </div>
      {gone ? (
        <p className="mt-4 text-sm text-white/70" data-loyalty-card-gone>
          Your credit here stays yours; ask Mesita support to use it.
        </p>
      ) : (
        /* THE ACTIONS, IN THE PAGE (MESITA-3868): under the card, scrolling
           with it. Since MESITA-4253 (Pato picked drawing A of four, "Build
           A"): Pay is the one loud thing, a pink bar naming what can be spent
           here; Buy Credits and Send Gift are two dark doors under it, the
           Pay tab's look (MESITA-4250). They were three equal doors in three
           colours (MESITA-4095), none of them the main one. */
        /* FOUR DOORS, 2 × 2 (MESITA-4269, Pato: "four buttons: Pay Here.
           Send Gift. Offers. Share Mesita. maybe 2x2 matrix"): Pay here in
           Stripe purple and the place screen's own Offers box on top ("just
           reuse this box there"), Send Gift and Share Mesita dark under them.
           It was a pink Pay bar over a green Prepay bar (MESITA-4253/4262).
           Share Mesita left and View place took its slot as a grey door
           (MESITA-4273, Pato: "remove share mesita from here. view place must
           be same a grey button of the same size"); it was a pill under the
           card (MESITA-4116). Since MESITA-4281 the four are one bank row
           of round buttons. */
        <div className="mt-5 flex justify-around gap-1" data-loyalty-card-actions>
          {/* PREPAY FIRST, GREEN (Pato, 2026-11-23, MESITA-4816: "(Prepay)
              (Pay Bill) (Send Gift) (View Place). and make prepay green";
              View Offers before): get credit, spend it, share it, then the
              place. Shown where a voucher is sold; every offer is the Offers
              tile under the card. The discount badge is Prepay's one mark (MESITA-4843). */}
          {prepay ? (
            <PushLink
              href={offerHref(href, prepay, true)}
              className={ROUND}
              data-loyalty-card-prepay
            >
              <span className={cn(ROUND_FACE, "bg-[#635BFF] text-white")}>
                <BadgePercent className={ROUND_GLYPH} strokeWidth={2.25} aria-hidden />
              </span>
              Prepay
            </PushLink>
          ) : null}
          <PushLink
            href={payCodePath(row.placeId)}
            className={ROUND}
            aria-label={spendable > 0 ? `Pay Bill: use ${money(spendable, card.currency)} at the table` : "Pay Bill"}
            data-loyalty-card-pay
          >
            <span className={cn(ROUND_FACE, "bg-[#00D66F] text-neutral-950")}>
              <QrCode className={ROUND_GLYPH} strokeWidth={2.25} aria-hidden />
            </span>
            Pay Bill
          </PushLink>
          {/* Send Gift is its own page (MESITA-4096); it was a sheet here. */}
          {gift === "open" ? (
            <PushLink href={walletSendPath(row.placeId)} className={ROUND} data-send-credit-open>
              <span className={cn(ROUND_FACE, "text-foreground bg-white")}>
                <Gift className={ROUND_GLYPH} strokeWidth={2.25} aria-hidden />
              </span>
              Send Gift
            </PushLink>
          ) : gift ? (
            <button
              type="button"
              className={cn(ROUND, "opacity-50")}
              onClick={() => toast(gift.blocked)}
              aria-label={`Send Gift: ${gift.blocked}`}
              data-send-credit-open
            >
              <span className={cn(ROUND_FACE, "text-foreground bg-white")}>
                <Gift className={ROUND_GLYPH} strokeWidth={2.25} aria-hidden />
              </span>
              Send Gift
            </button>
          ) : null}
          <PushLink href={href} className={ROUND} data-loyalty-card-place>
            <span className={cn(ROUND_FACE, "text-foreground bg-white")}>
              <Store className={ROUND_GLYPH} strokeWidth={2.25} aria-hidden />
            </span>
            View Place
          </PushLink>
        </div>
      )}
      {held ? (
        <p className="text-muted-foreground mt-4 text-sm" data-loyalty-card-held>
          Some credit is held by an open payment. It returns when that payment finishes or expires.
        </p>
      ) : null}
      </Panel>
      {confirming ? (
        <p className="text-muted-foreground mt-4 text-sm" role="status" data-loyalty-card-confirming>
          Confirming a payment…
        </p>
      ) : null}

      {/* OFFERS SECOND (MESITA-4573): the card, then what to buy here, then
          the Tickets. THE PLACE PROFILE'S OFFERS TILE (Pato, 2026-11-21,
          MESITA-4577: "ALL OFFERS MUST BE SHOWN IN A CARROUSEL, JUST LIKE
          THE OFFERS THING IN PLACE PROFILE. YOU JUST CHANGE OFFER … PUT
          THAT GREEN BOX IN A BLACK BOX … ADD FUNDS, GET BONUS"): one black
          tile, full width and 64px, its chip in the offer's colour moving
          to the next offer on the profile's beat and held under the finger;
          a tap opens the Offers page on the offer on screen and comes back
          here (from=wallet). ITS WORD IS "OFFERS" (Pato, 2026-11-21,
          MESITA-4582: "here don't mention add funds get a bonus, just
          mention offers"), the profile tile's own. A sliding strip of green tiles for one deploy
          before (MESITA-4573). */}
      {!gone && offers.length > 0 ? (
        <OffersTile
          name={card.name}
          slides={offers}
          className="mt-4 h-16 w-full rounded-2xl"
          full
          open={(slide) => () => navigateTo(router, offerHref(href, slide, true), { motion: "drill" })}
        />
      ) : null}

      {/* MONEY ON ITS WAY (MESITA-4279): the pending lines, each with its
          countdown, stay in their own panel while there are any. */}
      {pending.length > 0 ? (
        /* THE WALLET'S BLUE BOXES (MESITA-4362, Pato: "I love the pending
            box between the black box and the tickets box … improve the
            design"): one box per amount on its way, its own live minutes,
            a tap opens its ticket. */
        /* IN ITS OWN BOX (MESITA-4364, Pato: "literally create a box called
            Pending Bonuses, and put the blue tint inside"). */
        <Panel title="Pending Bonuses" className="mt-4">
        <div className="flex flex-col gap-2 p-4" data-loyalty-card-pending-boxes>
          {pending.map((g, i) => {
            const words = pendingWords(g.amount_cents, card.currency, g.kind, g.available_at, now);
            const to = entryHref(row.placeId, g);
            const box = (
              <PendingBox icon={Clock3}>
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0">{words}</span>
                  {to ? <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> : null}
                </span>
              </PendingBox>
            );
            return to ? (
              <PushLink key={`w-${pendingKeys[i]}`} href={to} className="block rounded-xl transition active:opacity-80" aria-label={words}>
                {box}
              </PushLink>
            ) : (
              <div key={`w-${pendingKeys[i]}`}>{box}</div>
            );
          })}
        </div>
        </Panel>
      ) : null}

      {/* THIS PLACE'S TICKETS (MESITA-4279, Pato: "a scoped version of the
          notifications+tickets page but for that place"; option A of the
          board): Me › Tickets' pills and rows filtered to this place, one
          row per thing done here (a voucher with its bonus, a gift with its
          taking back). It was "Transactions", one ledger line per row
          (MESITA-4116). Notifications stay at Me. NO HEADING, A LINE
          (MESITA-4324, Pato: "remove the tickets word from there and just
          put a line dividing the section"): a hairline over the strip. */}
      <section className="mt-4" data-loyalty-card-tickets>
        <TicketsBoard kind={ticketKind} onPick={setTicketKind} placeId={row.placeId} flush={false} boxed onChanged={onReread} />
      </section>


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
              data-loyalty-card-remove
            >
              Remove from Wallet
            </button>
          ) : null}
        </div>
      ) : null}

      {removable ? (
        <LocalDialog open={removeOpen} onClose={() => (removing ? undefined : setRemoveOpen(false))} ariaLabel="Remove this Loyalty Card">
          <div className="flex flex-col px-4 pt-5 pb-8" data-loyalty-card-remove-confirm>
            <h2 className="text-xl font-semibold">Remove this Loyalty Card?</h2>
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
        </LocalDialog>
      ) : null}
    </>
  );
}
