"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, CreditCard, type LucideIcon, QrCode, Wallet as WalletIcon } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { money } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES, payCodePath, placeOffersPath } from "@/lib/consumer-route-contract";
import { navigateTo, replaceAddress } from "@/lib/navigate";
import { PlacePhoto, QUIET_BUTTON_CLASS } from "./pay-common";
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
//   [ Prepay ] [ Credits ] [ Pay ]   a tablist; only the chosen one has colour
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
        <WalletMenu tab={tab} onTab={chooseTab} />
        <div className={cn("my-2 flex min-h-0 flex-1 flex-col rounded-2xl p-1.5 transition-colors motion-reduce:transition-none", PAY_TAB_FILL[tab])} data-pay-menu-box={tab}>
          <div
            role="tabpanel"
            id="pay-panel"
            aria-labelledby={`pay-tab-${tab}`}
            className="bg-card text-foreground min-h-0 flex-1 overflow-hidden rounded-xl"
          >
            {tab === "cards" ? null : (
              // Its own scroller per tile, so each keeps its place.
              <KeptScroll key={tab} className="scrollbar-thin-dark h-full overflow-y-auto overscroll-contain">
                {tab === "prepay" ? (
                  <PlaceList
                    kind="prepay"
                    {...list}
                    onPick={(id) => navigateTo(router, placeOffersPath(id, "prepayment"), { motion: "drill" })}
                  />
                ) : (
                  <>
                    <PlaceList kind="pay" {...list} onPick={(id) => navigateTo(router, payCodePath(id), { motion: "drill" })} />
                    {/* Not listed, or the list did not load: the QR works anyway. */}
                    <div className="p-2.5">
                      <PushLink
                        href={CONSUMER_ROUTES.payCode}
                        className={cn(QUIET_BUTTON_CLASS, "flex items-center justify-center")}
                        data-pay-pick-any
                      >
                        My place isn&apos;t here
                      </PushLink>
                    </div>
                  </>
                )}
              </KeptScroll>
            )}
            {/* Always mounted, so its read runs with the others. */}
            <KeptScroll className={cn("scrollbar-thin-dark h-full overflow-y-auto overscroll-contain", tab !== "cards" && "hidden")}>
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

const TILES: Record<PayTab, { word: string; icon: LucideIcon; ink: string }> = {
  prepay: { word: "Prepay", icon: WalletIcon, ink: "#008A48" },
  cards: { word: "Credits", icon: CreditCard, ink: "#171717" },
  pay: { word: "Pay", icon: QrCode, ink: "#635BFF" },
};

/** THE MENU: three equal tiles, only the chosen one in its colour (look A).
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
            className={cn(PAY_TILE, on ? PAY_TAB_FILL[id] : "bg-muted text-foreground hover:bg-foreground/10")}
            data-pay-tab={id}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: ink }} aria-hidden>
              <Icon className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="text-base leading-tight font-semibold">{word}</span>
          </button>
        );
      })}
    </div>
  );
}
