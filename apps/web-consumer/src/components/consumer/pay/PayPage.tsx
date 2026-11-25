"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Percent, ChevronRight, type LucideIcon, QrCode, Wallet as WalletIcon, X } from "lucide-react";
import { money } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES, payCodePath, placeOffersPath } from "@/lib/consumer-route-contract";
import { hasInAppBack, lastMoveWasTraverse, navigateTo, noteTraverse, replaceAddress } from "@/lib/navigate";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { PlacePhoto } from "./pay-common";
import { roundLocation, usePayLocation, type Loc } from "./pay-location";
import { useActiveLocation } from "@/lib/active-location";
import { useUserLocation } from "@/lib/use-user-location";
import { usePayPlaces } from "./use-pay-places";
import { useOpenBill } from "./use-open-bill";
import type { GuestBill } from "@/lib/api/pay-bill";
import { PayHeader } from "./PayHeader";
import { PayFrameLoading } from "./PayFrameLoading";
import { PlaceList } from "./PayPick";
import { TicketsShortcut } from "./TicketsShortcut";
import { PAY_FILL, PAY_TILE, type PayModal, payModalPath, readPayModal, SECTION_CARD, SECTION_ROWS, SECTION_TITLE } from "./pay-sections";
import { WalletSection } from "@/components/consumer/wallet/WalletSection";

// THE WALLET, /pay (Pato, 2026-11-24, MESITA-4846, /plan-design-review: "Build
// A, full page"):
//
//   Mesita ................................ [Tickets]
//   Pending Tickets                  only with an open bill (MESITA-4625)
//   [   Prepay   ] [    Pay    ]     half each; each opens its modal
//   +--------- Credits ---------+
//   | the Loyalty Cards          |  one black box to the bar, scrolling inside
//   +----------------------------+
//
// Prepay's modal: the places that sell credit; a row opens its Offers. Pay's:
// the places to pay at; a row opens the one QR (/pay/code), which stays its
// own page. With an open bill, Pay opens that bill (one at a time,
// MESITA-3772). The page paints whole: it stays the loading frame until every
// read answered (MESITA-4586).

export function PayPage({
  giftToken = null,
}: {
  /** /wallet/gift/<token>: a friend's credit link opens over Credits. */
  giftToken?: string | null;
} = {}) {
  const router = useRouter();
  const modal = readPayModal(useSearchParams().get("tab"));
  const openModal = (m: PayModal) => {
    if (openNow() === m) return;
    noteTraverse(false);
    window.history.pushState(null, "", payModalPath(m));
  };
  // ✕ is Back; a modal opened cold (an old address) has only the Wallet under it.
  const closeModal = () => {
    if (openNow() === null) return;
    if (hasInAppBack()) router.back();
    else replaceAddress(CONSUMER_ROUTES.pay);
  };
  // THE PICK TAKES THE LIST'S PLACE (Pato, 2026-11-24, MESITA-4896: "if i press
  // x, redirect to main pay page, not to the second page"): ✕, Back and Done
  // from the QR or the offers land here with no list open.
  const pick = (href: string) => navigateTo(router, href, { replace: true, motion: "push" });
  const { loc: phone, askLocation, notNow } = usePayLocation({ prime: true });
  // HOME'S LOCATION, THE SAME BOX (Pato, 2026-11-24, MESITA-4908): a saved
  // location chosen in it, or the phone's fix, sorts both lists.
  const chosen = useActiveLocation();
  const fix = useUserLocation();
  const point = chosen ?? fix;
  const loc: Loc = point ? { state: "on", at: roundLocation(point) } : phone;
  const { places, failed: placesFailed, refresh: refreshPlaces } = usePayPlaces(loc.state === "on" ? loc.at : null);
  // The guest's one open bill (MESITA-4823); undefined while it is read.
  const bill = useOpenBill();

  // Nearest first; a place with no distance goes last.
  const sorted =
    places &&
    [...places].sort((x, y) => (x.distance_m === null ? 1 : y.distance_m === null ? -1 : x.distance_m - y.distance_m));
  const [walletReady, setWalletReady] = useState(false);
  const onWalletReady = useCallback(() => setWalletReady(true), []);
  const allReady = walletReady && (places !== null || placesFailed) && bill !== undefined;
  const [shown, setShown] = useState(false);
  if (allReady && !shown) setShown(true);

  const list = {
    places: sorted,
    failed: placesFailed,
    loc,
    onUseLocation: askLocation,
    onNotNow: notNow,
    onRefresh: refreshPlaces,
  };

  return (
    <>
      {shown ? null : <PayFrameLoading />}
      <div className={cn("bg-card flex h-full min-h-0 flex-col px-2", !shown && "hidden")}>
        <PayHeader title="Mesita" action={<TicketsShortcut icon />} />
        {bill ? (
          <section className={cn(SECTION_CARD, "shrink-0")} aria-label="Pending Tickets" data-pay-pending>
            <h2 className={SECTION_TITLE}>Pending Tickets</h2>
            <div className={SECTION_ROWS}>
              <OpenBillPanel bill={bill} />
            </div>
          </section>
        ) : null}
        <div className="mt-2 grid shrink-0 grid-cols-2 gap-2" data-pay-tiles>
          <Tile id="prepay" onClick={() => openModal("prepay")} />
          <Tile
            id="pay"
            line={bill ? "See your bill" : undefined}
            onClick={() => (bill ? navigateTo(router, CONSUMER_ROUTES.payCode, { motion: "drill" }) : openModal("pay"))}
          />
        </div>
        {/* ONE BORDER, black, its title on it; 8px off every side, the tiles'
            corners (Pato, MESITA-4848: "i don't like the credits box without
            margin"; edge to edge before). */}
        <section className="bg-foreground my-2 flex min-h-0 flex-1 flex-col rounded-2xl px-1.5 pb-1.5" aria-labelledby="pay-credits" data-pay-credits>
          <h2 id="pay-credits" className={cn(MARK_WORD, "text-background flex h-12 shrink-0 items-center justify-center gap-2")}>
            <WalletIcon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            Credits
          </h2>
          <div className="bg-card text-foreground flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
            <KeptScroll className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <WalletSection onReady={onWalletReady} giftToken={giftToken} />
            </KeptScroll>
          </div>
        </section>
      </div>
      <PlaceModal id="prepay" open={modal === "prepay"} onClose={closeModal}>
        <PlaceList
          kind="prepay"
          {...list}
          onPick={(id) => pick(placeOffersPath(id, "prepayment"))}
        />
      </PlaceModal>
      <PlaceModal id="pay" open={modal === "pay"} onClose={closeModal}>
        <PlaceList kind="pay" {...list} onPick={(id) => pick(payCodePath(id))} />
      </PlaceModal>
    </>
  );
}

/** The modal the address names right now. */
function openNow(): PayModal | null {
  return readPayModal(new URLSearchParams(window.location.search).get("tab"));
}

function focusTitle(el: HTMLElement | null) {
  el?.focus({ preventScroll: true });
}

/** A FULL-PAGE MODAL (Pato, 2026-11-24, MESITA-4846): from the bottom over the
 *  whole app, its title and ✕ alone (Pato, MESITA-4929: "header must be only
 *  header"; ✕ left and Home's location box right under MESITA-4908), then
 *  PlaceList: the search, then the places (MESITA-4969: Home's location
 *  sorts them; this modal has no location control). A reload on it
 *  shows it at once. */
function PlaceModal({
  id,
  open,
  onClose,
  children,
}: {
  id: PayModal;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [back] = useState(() => open && lastMoveWasTraverse());
  const { word } = TILES[id];
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel={word} fullScreen startShown={back}>
      <div className="border-border bg-card text-foreground shrink-0 border-b pt-[env(safe-area-inset-top)]" data-pay-modal={id}>
        <div className="flex h-14 items-center gap-1 pr-1.5 pl-4">
          {/* Focus lands on the title, so no ring is drawn on ✕ at opening. */}
          <h2 ref={focusTitle} tabIndex={-1} className="min-w-0 flex-1 truncate text-xl font-semibold outline-none">
            {word}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition">
            <X className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </div>
      {children}
    </LocalSheet>
  );
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

// A plain % (Pato, MESITA-4876; a badge around it under MESITA-4859) and
// the QR, the same marks everywhere.
const TILES: Record<PayModal, { word: string; line: string; icon: LucideIcon; ink: string }> = {
  prepay: { word: "Prepay", line: "Get Bonus", icon: Percent, ink: "bg-white text-indigo-500" },
  pay: { word: "Pay Bill", line: "Cash, Card, or Credits", icon: QrCode, ink: "bg-neutral-950 text-white" },
};

/** ONE LETTER SIZE for the three words (Pato, 2026-11-24,
 *  MESITA-4855: "prepay and pay and credits must be all same size"). */
const MARK_WORD = "text-base leading-tight font-semibold max-[374px]:text-sm min-[430px]:text-lg";

/** A tile, always in its own colour (MESITA-4842): its name, then what it
 *  gets you, one line (Pato, MESITA-4869). */
function Tile({ id, line: own, onClick }: { id: PayModal; line?: string; onClick: () => void }) {
  const { word, line, icon: Icon, ink } = TILES[id];
  return (
    <button type="button" onClick={onClick} className={cn(PAY_TILE, PAY_FILL[id])} data-pay-tile={id}>
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", ink)} aria-hidden>
        <Icon className="h-6 w-6" strokeWidth={2.25} />
      </span>
      <span className="flex flex-col items-center gap-0.5 text-center">
        <span className={MARK_WORD}>{word}</span>
        <span className="type-body leading-none whitespace-nowrap max-[374px]:text-xs">{own ?? line}</span>
      </span>
    </button>
  );
}
