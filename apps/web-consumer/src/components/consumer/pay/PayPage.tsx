"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { BadgePercent, ChevronRight, type LucideIcon, QrCode, Wallet as WalletIcon, X } from "lucide-react";
import { money } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES, payCodePath, placeOffersPath } from "@/lib/consumer-route-contract";
import { hasInAppBack, lastMoveWasTraverse, navigateTo, noteTraverse, replaceAddress } from "@/lib/navigate";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { PlacePhoto } from "./pay-common";
import { usePayLocation } from "./pay-location";
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
  const { loc, askLocation, notNow } = usePayLocation({ prime: true });
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

  // TEN ROWS TO SEE IT FULL (Pato, 2026-11-24, MESITA-4844: "for the moment,
  // display the same place 10 times"). Test mode only: a live place ends it.
  // Remove once he has seen it.
  const filled =
    sorted && sorted.length > 0 && sorted.length < 10 && sorted.every((p) => p.test_mode)
      ? Array.from({ length: 10 }, (_, i) => sorted[i % sorted.length])
      : sorted;
  const list = {
    places: filled,
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
            onClick={() => (bill ? navigateTo(router, CONSUMER_ROUTES.payCode, { motion: "drill" }) : openModal("pay"))}
          />
        </div>
        {/* ONE BORDER, black, its title on it; 8px off every side, the tiles'
            corners (Pato, MESITA-4848: "i don't like the credits box without
            margin"; edge to edge before). */}
        <section className="bg-foreground my-2 flex min-h-0 flex-1 flex-col rounded-2xl px-1.5 pb-1.5" aria-labelledby="pay-credits" data-pay-credits>
          <h2 id="pay-credits" className="text-background flex h-12 shrink-0 items-center justify-center gap-2 text-lg font-semibold">
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
          onPick={(id) => navigateTo(router, placeOffersPath(id, "prepayment"), { motion: "drill" })}
        />
      </PlaceModal>
      <PlaceModal id="pay" open={modal === "pay"} onClose={closeModal}>
        <PlaceList kind="pay" {...list} onPick={(id) => navigateTo(router, payCodePath(id), { motion: "drill" })} />
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
 *  whole app, its title with ✕, the place table under it, all white (Pato,
 *  MESITA-4852: "keep it clean"; the tile's colour before). Back to it (from a
 *  place, from the QR) shows it at once. */
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
        <div className="grid h-14 grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-center">
          <span />
          {/* Focus lands on the title, so no ring is drawn on ✕ at opening. */}
          <h2 ref={focusTitle} tabIndex={-1} className="text-center text-xl font-semibold outline-none">
            {word}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-14 items-center justify-center">
            <X className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </div>
      {/* No bar over the table (Pato, 2026-11-24, MESITA-4845). */}
      <KeptScroll className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</KeptScroll>
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

// The discount badge and the QR, the same marks everywhere (MESITA-4844).
const TILES: Record<PayModal, { word: string; icon: LucideIcon; ink: string }> = {
  prepay: { word: "Prepay", icon: BadgePercent, ink: "bg-white text-indigo-500" },
  pay: { word: "Pay", icon: QrCode, ink: "bg-neutral-950 text-white" },
};

/** A tile, always in its own colour (MESITA-4842). */
function Tile({ id, onClick }: { id: PayModal; onClick: () => void }) {
  const { word, icon: Icon, ink } = TILES[id];
  return (
    <button type="button" onClick={onClick} className={cn(PAY_TILE, PAY_FILL[id])} data-pay-tile={id}>
      <span className={cn("flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full", ink)} aria-hidden>
        <Icon className="h-9 w-9" strokeWidth={2.25} />
      </span>
      <span className="text-xl leading-tight font-semibold">{word}</span>
    </button>
  );
}
