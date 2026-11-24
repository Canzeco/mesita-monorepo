"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgePercent, ChevronRight, CreditCard, type LucideIcon, QrCode, Wallet as WalletIcon } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { Skeleton } from "@/components/shared/Skeleton";
import { EFError } from "@/lib/api/_invoke";
import { apiGetTab, apiListVisits, type GuestTab } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { billRead, payHere, type BillRead } from "@/lib/pay-wallet";
import { pendingTicket, readDraft } from "@/lib/guest-pay-draft";
import { readAmount } from "@mesita/place-profile/lib/money";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES, payBillPath, payPlacePath, placeOffersPath } from "@/lib/consumer-route-contract";
import { markPanelExit, navigateTo, previousEntryPath, replaceAddress } from "@/lib/navigate";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { forgetGuestTab, PlacePhoto, readGuestTabIds } from "./pay-common";
import { usePayLocation } from "./pay-location";
import { usePayPlaces } from "./use-pay-places";
import { usePendingTicket } from "./PendingTicketBanner";
import { PayHeader } from "./PayHeader";
import { PayFrameLoading } from "./PayFrameLoading";
import { firstOfferTab, NearbyOffers, PayPickSheet } from "./PayPick";
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
  pick = false,
  tab: firstTab = "offers",
}: {
  /** /wallet/gift/<token>: a friend's credit link opens over Pay. */
  giftToken?: string | null;
  /** /pay?pick=1: Choose another place, or /pay/pick, opens the sheet. */
  pick?: boolean;
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
  const getSupabase = useLazyBrowserSupabase();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickDismissed = useRef(false);
  // Pay never asks for the location (the picker does); a fix the browser
  // already grants names the place the guest is at (MESITA-4232, D5).
  const { loc, askLocation, notNow } = usePayLocation({ prime: true });
  const { places, failed: placesFailed, refresh: refreshPlaces } = usePayPlaces(loc.state === "on" ? loc.at : null);
  // null while the open payment is still being looked for.
  const [openTabs, setOpenTabs] = useState<GuestTab[] | null>(null);
  const [billFacts, setBillFacts] = useState<{ visitsOk: boolean; missed: boolean } | null>(null);
  const [billNonce, setBillNonce] = useState(0);

  // The guest's own payments still in progress (paying, or paid and not yet
  // signed, inside their window), read fresh each time: the one the server
  // names (MESITA-3772, any device) and this device's list (MESITA-3709). A
  // finished one is forgotten. A failed server read falls back to the list.
  useEffect(() => {
    let cancelled = false;
    const local = readGuestTabIds();
    void apiListVisits(getSupabase())
      .then((r) => ({ ok: true as const, id: pickOpenGuestPayment(r.visits, Date.now())?.tab_id ?? null }))
      .catch(() => ({ ok: false as const, id: null as string | null }))
      .then((server) => {
        const ids = server.id
          ? [server.id, ...local.filter((x) => x !== server.id)]
          : local;
        return Promise.all(
          ids.map((id) =>
            apiGetTab(getSupabase(), id)
              .then((r) => r.tab)
              .catch((e) => {
                if (e instanceof EFError && (e.status === 404 || e.status === 403)) {
                  forgetGuestTab(id);
                  return null;
                }
                return "miss" as const;
              }),
          ),
        ).then((tabs) => ({ ok: server.ok, tabs }));
      })
      .then(({ ok, tabs }) => {
        if (cancelled) return;
        const now = Date.now();
        const missed = tabs.some((t) => t === "miss");
        const live = tabs.filter((t): t is GuestTab => {
          if (!t || t === "miss") return false;
          const open =
            !t.verified_at &&
            Date.parse(t.expires_at) > now &&
            (t.status === "paying" || t.status === "paid");
          if (!open) forgetGuestTab(t.tab_id);
          return open;
        });
        setOpenTabs(live);
        setBillFacts({ visitsOk: ok, missed });
      });
    return () => {
      cancelled = true;
    };
    // getSupabase is a new function each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billNonce]);

  const pending = usePendingTicket();
  const bill: BillRead =
    billFacts === null
      ? "loading"
      : billRead({
          visitsOk: billFacts.visitsOk,
          missed: billFacts.missed,
          live: openTabs?.length ?? 0,
          draft: pending !== null || pendingTicket() !== null,
        });

  useEffect(() => {
    if (billFacts) return;
    const id = window.setTimeout(() => setBillFacts({ visitsOk: false, missed: false }), 10_000);
    return () => window.clearTimeout(id);
  }, [billFacts]);

  // ?pick=1 waits for the bill read. A live tab or a draft strips the flag
  // and shows the bill. Otherwise the sheet opens on the entry that is
  // already there. A tap while the read is in flight hits the skeleton.
  useEffect(() => {
    if (!pick || bill === "loading") return;
    if (bill === "open" || bill === "unknown") {
      replaceAddress(CONSUMER_ROUTES.pay);
      return;
    }
    if (pickDismissed.current) return;
    setPickerOpen(true);
  }, [pick, bill]);

  // Browser Back while the sheet is open. Capture phase, so ScreenStage's
  // bubble listener sees the panel-exit mark and does not slide the wallet.
  // The browser already popped; this does not call history.back() again.
  useEffect(() => {
    if (!pickerOpen) return;
    function onPop() {
      setPickerOpen(false);
      markPanelExit();
    }
    window.addEventListener("popstate", onPop, true);
    return () => window.removeEventListener("popstate", onPop, true);
  }, [pickerOpen]);

  function openPicker() {
    if (pickerOpen) return;
    window.history.pushState({ paySheet: 1 }, "");
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
    const state = window.history.state as { paySheet?: number } | null;
    // history.back() fires popstate, and the capture listener marks the
    // panel exit. Marking here too would swallow the next slide.
    if (state?.paySheet === 1) {
      window.history.back();
      return;
    }
    if (!pick) return;
    pickDismissed.current = true;
    if (previousEntryPath() === CONSUMER_ROUTES.pay) {
      window.history.back();
      return;
    }
    markPanelExit();
    replaceAddress(CONSUMER_ROUTES.pay);
  }

  function choosePlace(id: string) {
    const href = payPlacePath(id);
    const state = window.history.state as { paySheet?: number } | null;
    const onPay = previousEntryPath() === CONSUMER_ROUTES.pay;
    // The sheet stays painted until step 2 replaces the screen (MESITA-4606):
    // closing it first showed the Wallet for a frame between the steps.
    if (state?.paySheet === 1 || (pick && onPay)) {
      navigateTo(router, href, { replace: true, motion: "push" });
      return;
    }
    if (pick) {
      pickDismissed.current = true;
      replaceAddress(CONSUMER_ROUTES.pay);
    }
    navigateTo(router, href, { motion: "push" });
  }

  // Nearest first; a place with no distance goes last. No search bar on
  // the page (Pato, 2026-11-21, MESITA-4519: "this page must not have
  // searchbar"); the Pay Bill sheet keeps its own.
  const shownPlaces = [...(places ?? [])].sort((x, y) =>
    x.distance_m === null ? 1 : y.distance_m === null ? -1 : x.distance_m - y.distance_m,
  );
  const payBusy = payHere(bill) === "wait";
  const checkBill = () => {
    setBillFacts(null);
    setBillNonce((n) => n + 1);
  };
  const paySelected = () => {
    const decision = payHere(bill);
    if (decision === "recheck") return checkBill();
    if (decision === "wait") return;
    const href =
      decision === "bill"
        ? openTabs?.[0]
          ? payBillPath(openTabs[0].tab_id)
          : pending
            ? payPlacePath(pending.placeId)
            : null
        : null;
    // PAY BILL ALWAYS ASKS WHERE (Pato, 2026-11-21, MESITA-4523: "you click
    // pay bill and then you select the place in the modal that opens. yes.
    // double step. but it keeps everything clean"): no place is chosen on
    // the page; with no open bill, Pay Bill opens the sheet.
    if (href) navigateTo(router, href, { motion: "push" });
    else if (decision !== "bill") openPicker();
  };

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
  const allReady = walletReady && (places !== null || placesFailed) && bill !== "loading";
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
      <PayHeader title="Mesita Wallet" action={<WalletHeaderActions />} />

      {bill === "unknown" ? (
        <p className="text-muted-foreground px-2 py-3 text-sm" role="alert" data-error="open_bill_unknown">
          Couldn&apos;t check for an open bill.
          <button type="button" className="text-foreground ml-2 font-semibold underline" onClick={checkBill}>
            Check again
          </button>
        </p>
      ) : null}

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
      {bill === "open" ? (
        <section className={SECTION_CARD} aria-label="Pending Tickets" data-pay-pending>
          <h2 className={SECTION_TITLE}>Pending Tickets</h2>
          <div className={SECTION_ROWS}>
            <OpenBillPanel tab={openTabs?.[0] ?? null} pending={pending} places={places} />
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
          {/* THE NAME (Pato, 2026-11-23, MESITA-4753: "call the box Prepay &
              Get Bonus"; the purple one stays Pay Bill): the words carry the
              bonus, so the Get Bonus pill is gone. */}
          <span className={cn(ICON_CIRCLE, "bg-neutral-950 text-white")} aria-hidden>
            {/* THE WALLET, Prepay's one mark (Pato, 2026-11-23, MESITA-4762: "i
                don't like the icon for prepay"; the Offers Prepay tab's since
                MESITA-4726). */}
            <WalletIcon className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <span className={TILE_TITLE}>Prepay &amp; Get Bonus</span>
        </PushLink>
        {payBusy ? (
          <Skeleton className="aspect-[8/5] min-w-0 rounded-2xl bg-[#635BFF]/40" aria-hidden />
        ) : (
          <button
            type="button"
            className={cn(TILE, "bg-[#635BFF] text-white hover:bg-[#5249e6]")}
            aria-label={bill === "open" ? "Pay your open bill" : "Pay Bill"}
            onClick={paySelected}
            data-pay-bill
          >
            <span className={ICON_CIRCLE} style={{ color: "#635BFF" }} aria-hidden>
              <QrCode className="h-6 w-6" strokeWidth={2.25} />
            </span>
            <span className={TILE_TITLE}>Pay Bill</span>
          </button>
        )}
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
      <PayPickSheet open={pickerOpen} onClose={closePicker} onPick={choosePlace} />
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
  "flex aspect-[8/5] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center transition active:scale-[0.99]";
/** A tile's name: one baseline across the two. ONE SIZE (Pato, 2026-11-23,
 *  MESITA-4754: "standardize text size"): 16px semibold, the grey buttons'
 *  size (18px before). */
const TILE_TITLE = "text-lg leading-tight font-semibold"; // 18px: "a bit bigger" (MESITA-4793)
/** THE ICON IN A WHITE CIRCLE (Pato, 2026-11-21, MESITA-4586: "+icon inside
 *  a circle … with white background, and purple thing also inside a circle";
 *  /plan-design-review pick): 40px, the tile's ink on white, the Loyalty
 *  Card page's round buttons' look. The tiles grew 88 to 96px to hold it. */
const ICON_CIRCLE = "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white"; // 48px: "a bit bigger" (MESITA-4793)

/** Pay Bill's shape while the open-bill read runs, so a bill that is open
 *  never flashes the black button first. */
export function PayBillSkeleton() {
  return <Skeleton className="mt-2 h-11 w-full rounded-xl" aria-hidden />;
}

/** The open bill on /pay (MESITA-4086): one panel, the place's photo and
 *  name, the bill (with tip and total once known), its state, then one
 *  black Continue to the same address the amber band opens. A bill sent to
 *  the waiter wins over one still being filled in on this phone, as in the
 *  band. Read from what Pay already holds: no new call.
 *
 *  AMBER, AND IT WARNS (Pato, 2026-11-15, MESITA-4091: "if i leaved something
 *  open, write it yellow and mention that must be completed or canceled
 *  before creating other ticket"): the band's amber, the line "Finish or
 *  cancel this bill before you start a new one.", and a quiet Cancel bill
 *  under Continue. It asks first, like every Cancel bill (MESITA-4068); a
 *  draft is thrown away on this phone, a sent bill goes through the guest's
 *  own cancel (consumer-web-cancel-tab, as on the bill's page). */
function OpenBillPanel({
  tab,
  pending,
  places,
}: {
  tab: GuestTab | null;
  pending: { placeId: string; name: string | null } | null;
  places: PayPlace[] | null;
}) {
  const placeId = tab ? tab.place.id : (pending?.placeId ?? "");
  const listed = places?.find((p) => p.place_id === placeId);
  const name = (tab ? tab.place.name : pending?.name) ?? listed?.name ?? null;
  const href = tab ? payBillPath(tab.tab_id) : payPlacePath(placeId);
  const draft = tab ? null : readDraft(placeId);
  const currency = tab?.currency ?? listed?.currency ?? "mxn";
  const bill = tab ? tab.bill_cents : draft ? readAmount(draft.amount) : null;
  const tip = tab ? tab.card_tip_cents + tab.cash_tip_cents : 0;
  // THE SIGN TIMER (MESITA-4130): the server's expires_at, each second.
  const [now, setNow] = useState(() => Date.now());
  const waiting = tab !== null && tab.status !== "cancelled" && tab.status !== "expired" && !(tab.status === "paid" && tab.verified_at);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waiting]);
  const secs = tab ? Math.max(0, Math.ceil((Date.parse(tab.expires_at) - now) / 1000)) : 0;
  const countdown = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const line = waiting ? `Waiting for the waiter · ${countdown} left` : tab ? "Waiting for the waiter" : "Bill in progress";
  // ONE ROW OF PENDING TICKETS (MESITA-4623): the place, what it waits for
  // with the live countdown, the amount and ›; the bill's own page has
  // Continue and Cancel bill. The amber panel with both buttons before.
  return (
    <Link href={href} className={PENDING_ROW} data-pay-open-bill>
      <PlacePhoto place={{ photo: listed?.photo ?? null, name }} className="h-8 w-12 rounded-md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{name ?? "Your bill"}</span>
        <span className={PENDING_LINE} role={waiting ? "timer" : undefined} aria-live="off" data-pay-open-bill-timer>
          {line}
        </span>
      </span>
      {bill ? <span className="shrink-0 text-base font-semibold tabular-nums">{money(bill + tip, currency)}</span> : null}
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
