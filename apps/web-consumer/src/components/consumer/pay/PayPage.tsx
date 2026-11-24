"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgePercent, ChevronRight, CreditCard, type LucideIcon, QrCode, Wallet as WalletIcon } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { Skeleton } from "@/components/shared/Skeleton";
import { money } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES, placeOffersPath } from "@/lib/consumer-route-contract";
import { navigateTo, replaceAddress } from "@/lib/navigate";
import { PlacePhoto } from "./pay-common";
import { usePayLocation } from "./pay-location";
import { usePayPlaces } from "./use-pay-places";
import { useOpenBill } from "./use-open-bill";
import type { GuestBill } from "@/lib/api/pay-bill";
import { PayHeader } from "./PayHeader";
import { PayFrameLoading } from "./PayFrameLoading";
import { firstOfferTab, NearbyOffers } from "./PayPick";
import { WalletHeaderActions } from "./TicketsShortcut";
import { PAY_TAB_PARAM, type PayTab, SECTION_CARD, SECTION_ROWS, SECTION_TITLE } from "./pay-sections";
import { WalletSection } from "@/components/consumer/wallet/WalletSection";

// THE PAY TAB, /pay (MESITA-3304 credit, MESITA-3305 the card part,
// MESITA-3457 the list, MESITA-3536 its look): the places the guest can pay
// at now, nearest first: a search bar always shown (Pato,
// MESITA-3725: "searchbar must always be visible"; MESITA-3719 had hidden it
// behind a magnifier up to six places), and rows of
// profile photo, name, address and distance, led by the guest's open bill.
// A row is a door: /pay/place/<placeId> opens that place's bill at the table
// (PayTabScreen, MESITA-3564). The bill and the receipt have their own
// addresses (MESITA-3614): /pay/bill/<id> and /pay/receipt/<id>.
//
// THE PAY TAB, REDRAWN (Pato, 2026-11-17, MESITA-4232; /plan-design-review
// D3-D13):
//
//   Wallet ................................... [Tickets] (grey)  (MESITA-4245)
//   [ ▦ Pay Bill ]  112px (MESITA-4272), Stripe purple, the one coloured thing (MESITA-4260)
//   [ Buy Credits ] [ Send Gift ] [ Share Mesita ]  grey, no box
//   Payment Method: [ Visa ••4242 · In the app ]  (MESITA-4477; the other box is Loyalty Cards)
//   Loyalty Cards: rows, black pill = ready, amber line = pending
//
// Pay Bill opens a sheet over this page (MESITA-4478): the search bar and
// the places that were this page's own box (MESITA-4204), rising from the
// bottom. At a place (within AT_PLACE_M) it reads "Pay Bill at <place>" and
// opens that bill, "Other place" under it opens the sheet. With a bill open
// it IS the bill (the amber panel below). The bar is Home · Search · Pay ·
// Me; /wallet forwards here. /pay/pick redirects here with ?pick=1.
//
// ONE OPEN PAYMENT (Pato, 2026-11-11, MESITA-3772: "you can only have one
// ticket opened at a time ... in the pay page just display the button to go
// the ticket"): while the guest has a payment of their own open (found on
// the server, so from any device, and on this device's list), the Pay half
// shows that bill; no search bar, no places. Since MESITA-4086 (Pato: "if I
// am in the pay page, then actually show the payment ticket not in the
// header but in the center") it is one panel at the top of the page
// (OpenBillPanel): the place, the amounts, its state and Continue; the amber
// band (PendingTicketBanner) shows on every other tab, never on /pay.
//
// ONE LIST, EACH PLACE ONCE (Pato, 2026-11-20, MESITA-4497): under the
// header (two 40px grey pills: the saved card, Tickets) and the search bar,
// one white panel of rows split by a hairline: the places to pay at, nearest
// first, then the Loyalty Cards of places not listed above, then Add a
// Loyalty Card. A row: photo and name (open the place), the balance in plain
// bold, "+" (Add Funds, only where credit is sold) and one black Pay; a card
// row ends in Send. With a bill open every Pay opens that bill. No "Places"
// or "Loyalty" headings, no faded buttons. The drawing above is the history.
//
// ONE PAY OVER ONE-LINE PLACES (Pato, 2026-11-20, MESITA-4504): the band
// says Wallet. Under it, Payment Method and Tickets, then one filled Pay,
// then search, then the places.
//
// CHOOSE FIRST, THEN PAY (Pato, 2026-11-21, MESITA-4519, /plan-design-review:
// "pay bill is not selected and then you pay"; "the placeholders look like
// shit"): a white header. Since MESITA-4523 Pay Bill always opens the Pay
// Bill sheet to pick the place, and a card opens its Loyalty Card (a card
// tap selected the place for Pay in MESITA-4519/4520). Each place is a two-half card (PlaceActionRow)
// with its offers; no Add a Loyalty Card row and no search bar (the sheet
// has one). The notes above are the history.

export function PayPage({
  giftToken = null,
  tab: firstTab = "offers",
}: {
  /** /wallet/gift/<token>: a friend's credit link opens over Pay. */
  giftToken?: string | null;
  /** /pay?tab=cards: the tab the guest left (MESITA-4765, D6). */
  tab?: PayTab;
} = {}) {
  const router = useRouter();
  // NEARBY OFFERS | LOYALTY CARDS (Pato, 2026-11-23, MESITA-4765,
  // /plan-design-review D2, D6): the page opens on Nearby Offers; a switch
  // replaces the address (/pay?tab=cards), so Back from a place lands on the
  // tab the guest left, while a fresh Pay tap opens Nearby Offers.
  const [tab, setTab] = useState<PayTab>(firstTab);
  const chooseTab = (next: PayTab) => {
    setTab(next);
    replaceAddress(next === "cards" ? `${CONSUMER_ROUTES.pay}?${PAY_TAB_PARAM}=cards` : CONSUMER_ROUTES.pay);
  };
  // Pay never asks for the location (the picker does); a fix the browser
  // already grants names the place the guest is at (MESITA-4232, D5).
  const { loc, askLocation, notNow } = usePayLocation({ prime: true });
  const { places, failed: placesFailed, refresh: refreshPlaces } = usePayPlaces(loc.state === "on" ? loc.at : null);
  // The guest's one open bill (MESITA-4823); undefined while it is read.
  const bill = useOpenBill();

  // Nearest first; a place with no distance goes last. No search bar on
  // the page (Pato, 2026-11-21, MESITA-4519: "this page must not have
  // searchbar"); the Pay Bill sheet keeps its own.
  const shownPlaces = [...(places ?? [])].sort((x, y) =>
    x.distance_m === null ? 1 : y.distance_m === null ? -1 : x.distance_m - y.distance_m,
  );
  // LOAD ALL, SHOW ALL (Pato, 2026-11-21, MESITA-4586: "load all at the
  // same time and show placeholder loading while loading. i don't want you
  // to display certain things while not having others … load all, display
  // all. load not all, display none"): the page starts every read at once
  // (the open bill, the places, the Wallet and its photos, the payment
  // method) but stays the loading frame until each has answered, then
  // paints whole. Each read answers or fails on its own clock (the bill
  // check gives up at 10 s), so the frame always ends. Once shown it stays:
  // a later "Check again" never blanks the page. Before, each box painted
  // when its own read landed.
  const [walletReady, setWalletReady] = useState(false);
  // NO "BONUS PENDING" ROWS (Pato, 2026-11-22, MESITA-4638: "the blue box
  // below mentioning that is enough"): a bonus still landing shows only on
  // its place row's blue pending box; Pending Tickets is the open bill.
  const onWalletReady = useCallback(() => setWalletReady(true), []);
  const allReady = walletReady && (places !== null || placesFailed) && bill !== undefined;
  const [shown, setShown] = useState(false);
  if (allReady && !shown) setShown(true);

  return (
    <>
    {shown ? null : <PayFrameLoading />}
    {/* 8PX, NOT 16 (Pato, 2026-11-17, MESITA-4276: "make body margins far
        smaller in this page ... it feels like an old mobile app from the
        2010s"): 8px at the sides and 8px between Pay Bill, the doors and each
        panel, Home's one step (MESITA-4035); panels keep their 16px insides.
        Mounted (so its reads run) but hidden until all have answered. */}
    <KeptScroll className={cn("scrollbar-thin-dark bg-card flex h-full min-h-0 flex-col overflow-y-auto px-2 *:shrink-0", !shown && "hidden")}>
      {/* A CLEAN WHITE HEADER (MESITA-4519): the black slab of MESITA-4512
          is gone ("remove the dark background … just a line dividing stuff
          is clearer"). Payment Method and Tickets dark, then Pay Bill in
          Stripe purple again (Pato, MESITA-4523: "Pay Bill must be purple";
          black for one deploy, MESITA-4520), then Send Gift. */}
      {/* MESITA-4559 (Pato, 2026-11-21: "Mesita Wallet to the left,
          tickets to the right … just a ticket icon with this >. then pay at
          the top, also in purple. then add funds and send gift 50% and 50%.
          then below each place ticket"): Tickets rides the header as an
          icon; the Payment method | Tickets row is gone, so Pay Bill is the
          page's first button. */}
      <PayHeader title="Mesita" action={<WalletHeaderActions />} />

      {/* THREE BUTTONS IN ONE ROW (Pato, 2026-11-21, MESITA-4579: "try to
          put the buttons in a horizontal instead of vertical, the three
          buttons"): three equal tiles, 8px apart, 88px tall, the glyph over
          the word. Add Funds in Link green (#00D66F, the offers' green,
          black ink; it says "Add Funds, Get a Bonus" aloud) opens the
          places that sell credits (/wallet/buy); Pay Bill in Stripe purple,
          in the middle, opens the picker; Send Gift in black opens the place
          list to gift from. Stacked full width, 64px, for one deploy
          (MESITA-4574, Pato: "make three buttons bigger … Add Funds Green.
          Pay Bill purple … Send Gift … as a black box"). */}
      {/* PENDING TICKETS, A YELLOW BOX AT THE TOP (Pato, 2026-11-21,
          MESITA-4625: "above Prepay and Pay buttons, create a yellow box at
          the top … just a shortcut for the pending tickets … display the n
          pending things on top of green and purple in a section similar as
          the other sections, with a title"; below the buttons for one
          deploy, MESITA-4623). Shown only when something is pending, one row
          per ticket, each opening it: a bill waiting for the waiter in
          yellow. THE SAME CARD AS ITS SIBLINGS (Pato,
          2026-11-21, MESITA-4632: "this design looks like shit but the idea
          kinda works"): the amber box and the blue rows are gone; it wears
          Payment method's and Loyalty Cards' card, the grey title strip and
          white rows, each the place over one grey line. */}
      {bill ? (
        <section className={SECTION_CARD} aria-label="Pending Tickets" data-pay-pending>
          <h2 className={SECTION_TITLE}>Pending Tickets</h2>
          <div className={SECTION_ROWS}>
            <OpenBillPanel bill={bill} />
          </div>
        </section>
      ) : null}
      {/* PAY BILL, THEN PREPAY | SEND GIFT, THEN EXPLORE OFFERS (Pato,
          2026-11-23, MESITA-4731: "Pay Bill … bigger"; "Prepay … Get bonus
          credit"; "a button to send gifts"; "explore offers, even if it's kind
          of redundant"). Pay Bill is the one full-width purple button; Prepay
          (green) and Send Gift (black) share the second row; Explore Offers is
          a quiet full-width row. Prepay lists places that sell vouchers and
          lands on their Prepay tab; Explore Offers lists places with any offer
          and lands on their first one (D5). History: Get Discounts | Pay Bill
          half and half (MESITA-4587 … 4704). */}
      {/* PREPAY LEFT, PAY BILL RIGHT (Pato, 2026-11-23, MESITA-4748: "Prepay
          at the left. Pay at the right. Gift Credits somewhere, and maybe
          explore offers too"; /plan-design-review D2-D5): the two coloured
          112px tiles share one row, Pay Bill under the right thumb; Send Gift
          and Explore Offers follow as two quiet 48px outlined buttons (black
          Send Gift and a full-width Explore Offers row before, MESITA-4735).
          Under 360px the quiet pair stacks and the pill reads "Bonus", so
          nothing is cut. */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <PushLink
          href={CONSUMER_ROUTES.walletBuy}
          className={cn(TILE, "bg-[#00D66F] text-neutral-950 hover:bg-[#00c265]")}
          data-prepay
        >
          {/* PREPAY AND PAY (Pato, 2026-11-24, MESITA-4830: "just call them
              Prepay and Pay and below in little text explain"): one word, then
              one small line; "Prepay & Get Bonus" | "Pay Bill" before
              (MESITA-4753). */}
          <span className={cn(ICON_CIRCLE, "bg-neutral-950 text-white")} aria-hidden>
            {/* THE WALLET, Prepay's one mark (Pato, 2026-11-23, MESITA-4762: "i
                don't like the icon for prepay"; the Offers Prepay tab's since
                MESITA-4726). */}
            <WalletIcon className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span className={TILE_WORDS}>
            <span className={TILE_TITLE}>Prepay</span>
            <span className={TILE_LINE}>Pay ahead, get a bonus</span>
          </span>
        </PushLink>
        {/* THE WAITER LEADS (MESITA-4823): Pay Bill is the guest's QR; no
            place is picked. */}
        <PushLink
          href={CONSUMER_ROUTES.payCode}
          className={cn(TILE, "bg-[#635BFF] text-white hover:bg-[#5249e6]")}
          aria-label={bill ? "Pay: your bill is open" : "Pay: show the waiter your QR"}
          data-pay-bill
        >
          <span className={ICON_CIRCLE} style={{ color: "#635BFF" }} aria-hidden>
            <QrCode className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span className={TILE_WORDS}>
            <span className={TILE_TITLE}>Pay</span>
            <span className={TILE_LINE}>{bill ? "Your bill is open" : "Show the waiter your QR"}</span>
          </span>
        </PushLink>
      </div>
      {/* SEND GIFT LEFT FOR THE HEADER (MESITA-4780): the black full-width
          bar (MESITA-4765) hid the menu below; Gift now sits beside Tickets. */}

      {/* ONE MENU, TWO SECTIONS (Pato, 2026-11-23, MESITA-4765: "one menu
          with two sections (Nearby Offers) (Loyalty Cards)"; D1): the Offers
          page's grey switch (MESITA-4737), then the chosen tab's rows in one
          white bordered box. ALL WHITE (MESITA-4574): the box sits on the
          page's own white. */}
      {/* THE THIRD BOX (Pato, 2026-11-23, MESITA-4785: "three boxes. prepay
          pay and then the third box contains nearby offers and the other"):
          one white card with a hairline and a soft shadow (MESITA-4780's
          floating look), the black-pill switch at its top, a hairline, then
          the chosen tab's rows inside the same card. */}
      <div className="mt-2 flex flex-1 flex-col pb-8" data-pay-cards>
        {/* A BLACK FRAME (Pato, 2026-11-23, MESITA-4792: "box must be black,
            with white background or something to clearly represent the
            borders"): the switch sits on the black, the rows on a white
            panel inside it. */}
        <div className="bg-foreground rounded-2xl p-1.5 shadow-md" data-pay-menu-box>
        <div className="pb-1.5" data-pay-tabs-box>
          <PayTabs tab={tab} onTab={chooseTab} />
        </div>
        <div
          role="tabpanel"
          id={`pay-panel-${tab}`}
          aria-labelledby={`pay-tab-${tab}`}
          // Nearby Offers is one white panel; Loyalty Cards are white boxes of
          // their own on the black (MESITA-4794).
          // LIGHT GREY (MESITA-4810), white while its bones show.
          className={tab === "cards" ? undefined : cn("overflow-hidden rounded-xl", places === null && !placesFailed ? "bg-card" : "bg-muted")}
          data-pay-panel={tab}
        >
          {/* Both stay mounted, so each read runs and the page paints whole
              (MESITA-4586); the other is hidden. */}
          <div hidden={tab !== "offers"}>
            <NearbyOffers
              places={places === null && !placesFailed ? null : shownPlaces}
              failed={placesFailed}
              loc={loc}
              onUseLocation={askLocation}
              onNotNow={notNow}
              onRefresh={refreshPlaces}
              onPick={(id) =>
                navigateTo(router, placeOffersPath(id, firstOfferTab(places?.find((p) => p.place_id === id))), { motion: "drill" })
              }
            />
          </div>
          <div hidden={tab !== "cards"}>
            <WalletSection onReady={onWalletReady} giftToken={giftToken} />
          </div>
        </div>
        </div>
      </div>
    </KeptScroll>
    </>
  );
}

/** Every action tile (MESITA-4735): 112px, the icon disc top left and the
 *  name bottom left, so Pay Bill, Prepay and Send Gift read as one set,
 *  all one height (Pato, MESITA-4734: "purple and bottom buttons must be
 *  same height"). */
// CENTRED (Pato, 2026-11-23, MESITA-4753: "prepay icon and pay bill icon
// must be centered"): the icon disc and the name sit on the tile's middle line.
// SMALLER (Pato, 2026-11-23, MESITA-4778: "all in that page must be smaller
// or shorter"; /plan-design-review pick): 80px (112 before), 32px disc, 14px.
// TALLER, 8:5 (Pato, 2026-11-23, MESITA-4780: "make prepay and pay taller.
// maybe fibonacci proportion of 8:5"): each tile is 8 wide by 5 tall.
const TILE =
  "flex aspect-[8/5] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-center transition active:scale-[0.99]";
const TILE_WORDS = "flex max-w-full min-w-0 flex-col items-center";
/** The small line under a tile's name (MESITA-4830). */
const TILE_LINE = "max-w-full truncate text-xs leading-4";
/** A tile's name: one baseline across the two. ONE SIZE (Pato, 2026-11-23,
 *  MESITA-4754: "standardize text size"): 16px semibold, the grey buttons'
 *  size (18px before). */
const TILE_TITLE = "text-lg leading-tight font-semibold"; // 18px: "a bit bigger" (MESITA-4793)
/** THE ICON IN A WHITE CIRCLE (Pato, 2026-11-21, MESITA-4586: "+icon inside
 *  a circle … with white background, and purple thing also inside a circle";
 *  /plan-design-review pick): 40px, the tile's ink on white, the Loyalty
 *  Card page's round buttons' look. The tiles grew 88 to 96px to hold it. */
const ICON_CIRCLE = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white"; // 40px: room for the small line (MESITA-4830); 48px under MESITA-4793

/** Pay Bill's shape while the open-bill read runs, so a bill that is open
 *  never flashes the black button first. */
export function PayBillSkeleton() {
  return <Skeleton className="mt-2 h-11 w-full rounded-xl" aria-hidden />;
}

/** The open bill on /pay (MESITA-4086, MESITA-4823): one row of Pending
 *  Tickets: the place, what it waits for with the time left, the amount. */
function OpenBillPanel({ bill }: { bill: GuestBill }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.ceil((Date.parse(bill.expires_at) - now) / 1000));
  const left = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")} left`;
  const line = `${bill.state === "sent" ? "Bill to review" : "Pay at the place"} · ${left}`;
  const amount = bill.quote ? bill.quote.outside_cents : (bill.bill_cents ?? 0) + bill.tip_cents;
  return (
    <Link href={CONSUMER_ROUTES.payCode} className={PENDING_ROW} data-pay-open-bill>
      <PlacePhoto place={{ photo: bill.place.photo_url, name: bill.place.name }} className="h-8 w-8" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{bill.place.name ?? "Your bill"}</span>
        <span className={PENDING_LINE} role="timer" aria-live="off" data-pay-open-bill-timer>
          {line}
        </span>
      </span>
      <span className="shrink-0 text-base font-semibold tabular-nums">{money(amount, bill.currency)}</span>
      <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
    </Link>
  );
}

/** A Pending Tickets row and its one grey line (MESITA-4632): white, like
 *  the Loyalty Card rows under it; the line never wraps. */
const PENDING_ROW =
  "hover:bg-muted/40 flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition";
const PENDING_LINE = "text-muted-foreground block truncate text-sm tabular-nums";


/** PAY'S MENU (Pato, 2026-11-23, MESITA-4778: "nearby offers and loyalty
 *  cards must look more like menu to select"): Me › Tickets' strip, two
 *  halves, a little icon and the word, a bottom hairline, the chosen one ink
 *  over a 3px ink line, the other grey. A grey segmented switch before
 *  (MESITA-4765, D1). Arrow keys move between the two. */
const PAY_TABS: { id: PayTab; word: string; icon: LucideIcon }[] = [
  { id: "offers", word: "Nearby Offers", icon: BadgePercent },
  { id: "cards", word: "Loyalty Cards", icon: CreditCard },
];

function PayTabs({ tab, onTab }: { tab: PayTab; onTab: (t: PayTab) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number) => {
    const to = (from + 1) % PAY_TABS.length;
    onTab(PAY_TABS[to].id);
    refs.current[to]?.focus();
  };
  return (
    // SUPER VISIBLE (MESITA-4780): the chosen option a filled black pill,
    // white icon and word; the other grey. A 3px ink underline before.
    <div className="grid grid-cols-2 gap-1" role="tablist" aria-label="Pay" data-pay-tabs>
      {PAY_TABS.map(({ id, word, icon: Icon }, i) => {
        const on = tab === id;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`pay-tab-${id}`}
            aria-selected={on}
            aria-controls={`pay-panel-${id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onTab(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                move(i);
              }
            }}
            className={cn(
              "flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold whitespace-nowrap transition",
              // On the black frame (MESITA-4792): the picked tab a white pill.
              on ? "bg-card text-foreground" : "text-background/75 hover:bg-background/10 hover:text-background",
            )}
            data-pay-tab={id}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={on ? 2.5 : 2} aria-hidden />
            <span className="truncate">{word}</span>
          </button>
        );
      })}
    </div>
  );
}
