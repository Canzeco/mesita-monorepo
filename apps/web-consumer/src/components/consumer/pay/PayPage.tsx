"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgePercent, ChevronRight, type LucideIcon, QrCode, Wallet as WalletIcon } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { money } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES, payCodePath, placeOffersPath } from "@/lib/consumer-route-contract";
import { navigateTo, replaceAddress } from "@/lib/navigate";
import { PlacePhoto } from "./pay-common";
import { usePayLocation } from "./pay-location";
import { usePayPlaces } from "./use-pay-places";
import { useOpenBill } from "./use-open-bill";
import type { GuestBill } from "@/lib/api/pay-bill";
import { PayHeader } from "./PayHeader";
import { PayFrameLoading } from "./PayFrameLoading";
import { PlaceList } from "./PayPick";
import { TicketsShortcut } from "./TicketsShortcut";
import { PAY_TAB_FILL, PAY_TABS, PAY_TILE, type PayTab, payTabPath, SECTION_CARD, SECTION_ROWS, SECTION_TITLE } from "./pay-sections";
import { WalletSection } from "@/components/consumer/wallet/WalletSection";

// THE WALLET, /pay (Pato, 2026-11-24, MESITA-4838, /plan-design-review look
// A): "the top thing is not a button to a nested page, is a menu".
//
//   Mesita ................................ [Tickets]
//   Pending Tickets                  only with an open bill (MESITA-4625)
//   [ Prepay ] [ Credits ] [ Pay ]   a tablist; the chosen one joins its box
//   +-----------------------------+
//   | the chosen tile's list      |  one box in that colour, to the bar,
//   +-----------------------------+  scrolling inside
//
// Prepay: the places that sell credit; a row opens its Offers. Credits: the
// Loyalty Cards, each with its Gift button. Pay: the places to pay at; a row opens the one QR
// (/pay/code), which stays its own page. One open bill at a time
// (MESITA-3772). The page paints whole: it stays the loading frame until
// every read answered (MESITA-4586).

export function PayPage({
  giftToken = null,
  tab: firstTab = "pay",
}: {
  /** /wallet/gift/<token>: a friend's credit link opens over Credits. */
  giftToken?: string | null;
  /** The tile the address names. */
  tab?: PayTab;
} = {}) {
  const router = useRouter();
  const [tab, setTab] = useState<PayTab>(giftToken ? "cards" : firstTab);
  const chooseTab = (next: PayTab) => {
    // Before the render, so the new list's scroller keeps its own place.
    replaceAddress(payTabPath(next));
    setTab(next);
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
        <WalletMenu tab={tab} onTab={chooseTab} />
        {/* ONE BORDER (Pato, 2026-11-24, MESITA-4842: "i don't like double
            borders ... must be 100% width ... not green and then white"): the
            box runs edge to edge (-mx-2 undoes the page's 8px) and down to the
            bar, and what is inside touches its colour with no white gutter. */}
        <div className={cn("-mx-2 mt-2 flex min-h-0 flex-1 flex-col p-1.5", PAY_TAB_FILL[tab])} data-pay-menu-box={tab}>
          <div
            role="tabpanel"
            id="pay-panel"
            aria-labelledby={`pay-tab-${tab}`}
            className="bg-card text-foreground flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl"
          >
            {tab === "cards" ? null : (
              <>
                {/* Its own scroller per tile, so each keeps its place. No bar over the
                    table (Pato, 2026-11-24, MESITA-4845). */}
                <KeptScroll key={tab} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {tab === "prepay" ? (
                    <PlaceList
                      kind="prepay"
                      {...list}
                      onPick={(id) => navigateTo(router, placeOffersPath(id, "prepayment"), { motion: "drill" })}
                    />
                  ) : (
                    <PlaceList kind="pay" {...list} onPick={(id) => navigateTo(router, payCodePath(id), { motion: "drill" })} />
                  )}
                </KeptScroll>
                {tab === "pay" ? (
                  // AT THE BOTTOM, THE SEARCH ROW'S TWIN (Pato, 2026-11-24,
                  // MESITA-4839). Not listed, or the list did not load: the QR
                  // works anyway.
                  <PushLink
                    href={CONSUMER_ROUTES.payCode}
                    className="bg-card hover:bg-muted flex h-14 shrink-0 items-center justify-center border-t-[6px] border-[#00D66F] px-4 text-sm font-semibold transition"
                    data-pay-pick-any
                  >
                    My place isn&apos;t here
                  </PushLink>
                ) : null}
              </>
            )}
            {/* Always mounted, so its read runs with the others. */}
            <KeptScroll className={cn("scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain", tab !== "cards" && "hidden")}>
              <WalletSection onReady={onWalletReady} giftToken={giftToken} />
            </KeptScroll>
          </div>
        </div>
      </div>
    </>
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

// The discount badge and, for Credits, the wallet (Pato,
// 2026-11-24, MESITA-4844). The same marks everywhere.
const TILES: Record<PayTab, { word: string; icon: LucideIcon; ink: string }> = {
  prepay: { word: "Prepay", icon: BadgePercent, ink: "bg-white text-indigo-500" },
  cards: { word: "Credits", icon: WalletIcon, ink: "bg-white text-foreground" },
  pay: { word: "Pay", icon: QrCode, ink: "bg-neutral-950 text-white" },
};

/** ONE SHAPE WITH ITS BOX (Pato, 2026-11-24, MESITA-4839: "top box must be
 *  connect with bottom box when selected"): the tile's colour runs down the
 *  8px gap into the box, with a rounded inner corner on each side. */
function TileJoin({ fill }: { fill: string }) {
  const corner = (at: string) => ({ maskImage: `radial-gradient(circle at ${at} 0, transparent 7.5px, black 8px)` });
  return (
    <span className={cn("pointer-events-none absolute inset-x-0 top-full h-2", fill)} aria-hidden>
      <span className={cn("absolute top-0 -left-2 h-2 w-2", fill)} style={corner("0")} />
      <span className={cn("absolute top-0 -right-2 h-2 w-2", fill)} style={corner("100%")} />
    </span>
  );
}

/** THE MENU: three equal tiles, each always in its own colour (Pato,
 *  2026-11-24, MESITA-4842: "credits always black, pay always green, purple
 *  always purple"); the chosen one is joined to the box.
 *  Arrow keys move between them. */
function WalletMenu({ tab, onTab }: { tab: PayTab; onTab: (t: PayTab) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, by: number) => {
    const to = (from + by + PAY_TABS.length) % PAY_TABS.length;
    onTab(PAY_TABS[to]);
    refs.current[to]?.focus();
  };
  return (
    <div className="mt-2 grid shrink-0 grid-cols-3 gap-2" role="tablist" aria-label="Wallet" data-pay-tabs>
      {PAY_TABS.map((id, i) => {
        const on = tab === id;
        const { word, icon: Icon, ink } = TILES[id];
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
            aria-controls="pay-panel"
            tabIndex={on ? 0 : -1}
            onClick={() => onTab(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                move(i, e.key === "ArrowRight" ? 1 : -1);
              }
            }}
            className={cn(PAY_TILE, "group relative outline-none", PAY_TAB_FILL[id], on && "rounded-b-none")}
            data-pay-tab={id}
          >
            {/* The
                keyboard's ring is here: on the tile it cut the joined shape. */}
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-offset-2 ring-offset-transparent group-focus-visible:ring-2 group-focus-visible:ring-current", ink)} aria-hidden>
              <Icon className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="text-base leading-tight font-semibold">{word}</span>
            {on ? <TileJoin fill={PAY_TAB_FILL[id]} /> : null}
          </button>
        );
      })}
    </div>
  );
}
