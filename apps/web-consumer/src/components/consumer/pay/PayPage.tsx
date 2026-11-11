"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, ChevronRight, CreditCard, MapPin, QrCode, Search, Wallet } from "lucide-react";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { TestBand } from "@mesita/place-profile";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiGetTab, type GuestTab } from "@/lib/api/tab";
import { clockTime } from "@mesita/place-profile/lib/money";
import { money, type PayPlace, type WaitingStory } from "@/lib/api/wallet";
import { cardAmount } from "@/lib/wallet-card";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES, payPlacePath, payTabPath, walletPlacePath } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot, requestUserLocation } from "@/lib/use-user-location";
import { forgetGuestTab, PlacePhoto, readGuestTabIds } from "./pay-common";
import { usePayPlaces } from "./use-pay-places";
import { PayHeader } from "./PayHeader";
import { WalletSection } from "../wallet/WalletSection";
import { AddRow, StoryRow } from "../wallet/WalletLists";
import { type CreditRow, useWallet } from "../wallet/use-wallet";

// THE PAY TAB, /pay (MESITA-3304 credit, MESITA-3305 the card part,
// MESITA-3457 the list, MESITA-3536 its look): the places the guest can pay
// at now, nearest first: "Pay at a place", a search box (MESITA-3719: behind
// a magnifier up to six places), and rows of
// profile photo, name, address and distance, led by the guest's open bill.
// A row is a door: /pay/<placeId> opens that place's bill at the table
// (PayTabScreen, MESITA-3564). The bill and the receipt have their own
// addresses (MESITA-3614): /pay/tab/<id> and /pay/receipt/<id>.
//
// PAY IS ONE PAGE (Pato, 2026-11-11, MESITA-3720: "pay and wallet in the
// same subpage ... only one"): the header (PayHeader, no band), the payment
// in progress, "Pay at a place" (the nearest PLACES_SHOWN, then "Show all"),
// then "Wallet" (WalletSection). /wallet draws this page at its Wallet;
// MESITA-3698 had split them into two pages behind a Pay · Wallet band.
//
// CREDITS SIT ON THE PLACE (Pato, 2026-11-11, MESITA-3721, "Build it" on the
// design review's option C): a place row shows the credits the guest holds
// there. The row opens the bill; the amount is its own button and opens the
// place's House Card (/wallet/<placeId>). Places with credits lead, then the
// nearest; a Credits Card the Pay read does not list (a pinned $0 card far
// away) follows as a row that opens its House Card. "Add a Credits Card" is
// the box's last row; a waiting Story is a row under the payment in
// progress. The Wallet read (useWallet) is this page's; under the places
// sits one box, Money Payment Methods (WalletSection), still #wallet for
// /wallet. The "Wallet" heading and "Credits Payment Methods" are gone.
//
// The location is asked once, after a priming card ("See Mesita Payments
// places near you"), rounded to 3 decimals and sent only to the list read.

/** The location the list read carries, in decimals (~110 m). The server's
 *  twin is LOCATION_DECIMALS in _shared/pay-places.ts. */
const LOCATION_DECIMALS = 3;
/** "Not now" on the location card holds for this browser session. */
const LOCATION_NOT_NOW_KEY = "mesita.pay.location-not-now";

/** Past this many places the search field shows on its own. */
const SEARCH_FROM = 6;
/** Places listed before "Show all" (MESITA-3720). */
const PLACES_SHOWN = 5;

const round = (v: number) => Math.round(v * 10 ** LOCATION_DECIMALS) / 10 ** LOCATION_DECIMALS;

/** "350 m" / "2.4 km". */
function distanceText(m: number): string {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
}

type Loc =
  | { state: "unknown" }
  | { state: "prime" }
  | { state: "asking" }
  | { state: "blocked" }
  | { state: "off" }
  | { state: "on"; at: { lat: number; lng: number } };

function readNotNow(): boolean {
  try {
    return window.sessionStorage.getItem(LOCATION_NOT_NOW_KEY) === "1";
  } catch {
    return false;
  }
}

export function PayPage({ focus = null, giftToken = null }: { focus?: "wallet" | null; giftToken?: string | null } = {}) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const [loc, setLoc] = useState<Loc>({ state: "unknown" });
  const { places, failed, refresh } = usePayPlaces(loc.state === "on" ? loc.at : null);
  const [openTabs, setOpenTabs] = useState<GuestTab[]>([]);
  // The Wallet read: credits on the rows, waiting Stories, the sheets below.
  const { wallet, failed: walletFailed, credits, reread } = useWallet();
  const [story, setStory] = useState<WaitingStory | null>(null);
  // One TestBand for the page (MESITA-3303), from either read's flag: the
  // credits on the rows are the Wallet's money as much as the places'.
  const testMode = wallet?.test_mode === true || (places?.some((p) => p.test_mode) ?? false);

  // /wallet (and a friend's credit link) open this page at its Wallet.
  useEffect(() => {
    if (focus !== "wallet" && window.location.hash !== "#wallet") return;
    const t = setTimeout(() => document.getElementById("wallet")?.scrollIntoView({ block: "start" }), 0);
    return () => clearTimeout(t);
  }, [focus]);

  // MESITA-3709: the list leads with the guest's own payments still in
  // progress (paying, or paid and not yet verified, inside their window),
  // newest first, read fresh each time. A finished one is forgotten.
  useEffect(() => {
    const ids = readGuestTabIds();
    if (ids.length === 0) return;
    let cancelled = false;
    void Promise.all(
      ids.map((id) =>
        apiGetTab(getSupabase(), id)
          .then((r) => r.tab)
          .catch((e) => {
            if (e instanceof EFError && (e.status === 404 || e.status === 403)) forgetGuestTab(id);
            return null;
          }),
      ),
    ).then((tabs) => {
      if (cancelled) return;
      const now = Date.now();
      const live = tabs.filter((t): t is GuestTab => {
        if (!t) return false;
        const open = !t.verified_at && Date.parse(t.expires_at) > now && (t.status === "paying" || t.status === "paid");
        if (!open) forgetGuestTab(t.tab_id);
        return open;
      });
      setOpenTabs(live);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The location: a fix already in hand is used; a granted permission is
  // asked at once; otherwise the priming card asks first.
  useEffect(() => {
    let cancelled = false;
    const have = locationSnapshot().coords;
    const ask = () => {
      setLoc({ state: "asking" });
      void requestUserLocation().then((c) => {
        if (cancelled) return;
        if (c) setLoc({ state: "on", at: { lat: round(c.lat), lng: round(c.lng) } });
        else setLoc({ state: locationSnapshot().error === "denied" ? "blocked" : "off" });
      });
    };
    if (have) {
      // Deferred a tick: no state is set inside the effect's own body.
      void Promise.resolve().then(() => {
        if (!cancelled) setLoc({ state: "on", at: { lat: round(have.lat), lng: round(have.lng) } });
      });
    } else if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((s) => {
          if (cancelled) return;
          if (s.state === "granted") ask();
          else if (s.state === "denied") setLoc({ state: "blocked" });
          else setLoc({ state: readNotNow() ? "off" : "prime" });
        })
        .catch(() => {
          if (!cancelled) setLoc({ state: readNotNow() ? "off" : "prime" });
        });
    } else {
      void Promise.resolve().then(() => {
        if (!cancelled) setLoc({ state: readNotNow() ? "off" : "prime" });
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  function askLocation() {
    setLoc({ state: "asking" });
    void requestUserLocation().then((c) => {
      if (c) setLoc({ state: "on", at: { lat: round(c.lat), lng: round(c.lng) } });
      else setLoc({ state: locationSnapshot().error === "denied" ? "blocked" : "off" });
    });
  }

  function notNow() {
    try {
      window.sessionStorage.setItem(LOCATION_NOT_NOW_KEY, "1");
    } catch {
      // Private mode: the card comes back next visit, nothing else breaks.
    }
    setLoc({ state: "off" });
  }

  return (
    <KeptScroll className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8">
      <PayHeader />
      {testMode ? <TestBand className="mt-5 -mb-2" /> : null}

      <div className="mt-5 flex flex-col">
        {places ? (
          <PlaceList
            places={places}
            loc={loc}
            openTabs={openTabs}
            credits={credits}
            stories={wallet?.waiting_stories ?? []}
            creditsFailed={walletFailed && !wallet}
            onRetryCredits={reread}
            onOpenStory={setStory}
            onOpenTab={(id) => navigateTo(router, payTabPath(id), { motion: "push" })}
            onPick={(id) => navigateTo(router, payPlacePath(id), { motion: "push" })}
            onUseLocation={askLocation}
            onNotNow={notNow}
          />
        ) : failed ? (
          <EmptyState
            icon={QrCode}
            title="Couldn't load Pay"
            description="Check your connection and try again."
            action={{ label: "Try again", onClick: refresh }}
          />
        ) : (
          <ListSkeleton />
        )}
      </div>

      <section id="wallet" aria-label="Money Payment Methods" className="mt-3 scroll-mt-24">
        <WalletSection
          wallet={wallet}
          failed={walletFailed}
          reread={reread}
          giftToken={giftToken}
          story={story}
          onCloseStory={() => setStory(null)}
        />
      </section>
    </KeptScroll>
  );
}

/** Lower case, no accents: "Cafe" finds "Café". */
function fold(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** One row of the places box: a place the guest can pay at, or a Credits
 *  Card the Pay read does not list (`place` null: it opens its House Card). */
type PlaceRow = {
  id: string;
  name: string;
  photo: string | null;
  address: string | null;
  distance_m: number | null;
  place: PayPlace | null;
  /** The credits held there; null when the guest has no card at the place. */
  amount: { cents: number; pending: boolean; currency: string } | null;
  hasMoney: boolean;
};

/** Places with credits first, then the Pay read's own order (nearest). */
function placeRows(places: PayPlace[], credits: CreditRow[] | null): PlaceRow[] {
  const carded = new Set(credits?.map((c) => c.placeId) ?? []);
  const listed = new Set(places.map((p) => p.place_id));
  const rows: PlaceRow[] = places.map((p) => {
    const hasMoney = p.available_cents > 0 || p.pending_cents > 0;
    return {
      id: p.place_id,
      name: p.name ?? "A Mesita place",
      photo: p.photo,
      address: p.address,
      distance_m: p.distance_m,
      place: p,
      // The Pay read's numbers: what can be spent now.
      amount: hasMoney || carded.has(p.place_id) ? { ...cardAmount(p), currency: p.currency } : null,
      hasMoney,
    };
  });
  for (const c of credits ?? []) {
    if (listed.has(c.placeId)) continue;
    rows.push({
      id: c.placeId,
      name: c.card.name,
      photo: c.card.photo,
      address: null,
      distance_m: null,
      place: null,
      amount: { ...cardAmount(c.card), currency: c.card.currency },
      hasMoney: c.card.available_cents > 0 || c.card.pending_cents > 0,
    });
  }
  // Array.prototype.sort is stable: each group keeps its order.
  return rows.sort((a, b) => Number(b.hasMoney) - Number(a.hasMoney));
}

const ROW_MAIN = "hover:bg-muted/60 flex min-w-0 flex-1 items-center gap-3.5 py-3 pl-4 text-left transition";

function PlaceList({
  places,
  loc,
  openTabs,
  credits,
  stories,
  creditsFailed,
  onRetryCredits,
  onOpenStory,
  onOpenTab,
  onPick,
  onUseLocation,
  onNotNow,
}: {
  places: PayPlace[];
  loc: Loc;
  /** The guest's own payments still in progress (MESITA-3709). */
  openTabs: GuestTab[];
  /** The Wallet's cards (MESITA-3721); null until the Wallet has read. */
  credits: CreditRow[] | null;
  stories: WaitingStory[];
  creditsFailed: boolean;
  onRetryCredits: () => void;
  onOpenStory: (story: WaitingStory) => void;
  onOpenTab: (tabId: string) => void;
  onPick: (placeId: string) => void;
  onUseLocation: () => void;
  onNotNow: () => void;
}) {
  const [query, setQuery] = useState("");
  // MESITA-3719: the search field shows past SEARCH_FROM places, or once the
  // magnifier opens it; one place under a search bar is noise.
  const [searchOpen, setSearchOpen] = useState(false);
  const rows = placeRows(places, credits);
  const searchShown = searchOpen || rows.length > SEARCH_FROM;
  const q = fold(query.trim());
  const [showAll, setShowAll] = useState(false);
  const matches = q ? rows.filter((r) => fold(r.name).includes(q)) : rows;
  // The nearest PLACES_SHOWN, so the Wallet below is never far (MESITA-3720);
  // a search always lists every match.
  const shown = q || showAll ? matches : matches.slice(0, PLACES_SHOWN);
  const hidden = matches.length - shown.length;
  return (
    <div className="flex flex-col">
      {openTabs.map((t) => (
        <InProgressCard key={t.tab_id} tab={t} place={places.find((p) => p.place_id === t.place.id) ?? null} onOpen={() => onOpenTab(t.tab_id)} />
      ))}

      {stories.length > 0 ? (
        <div className="border-border bg-card mb-4 overflow-hidden rounded-2xl border" data-pay-stories>
          {stories.map((s, i) => (
            <Fragment key={s.purchase_id}>
              {i > 0 && <div className="bg-border ml-[4.75rem] h-px" />}
              <StoryRow story={s} onOpen={() => onOpenStory(s)} />
            </Fragment>
          ))}
        </div>
      ) : null}

      {loc.state === "prime" ? (
        <div className="border-border bg-card mb-3 rounded-2xl border px-4 py-4">
          <p className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            See places near you that take Mesita Payments
          </p>
          <div className="mt-3 flex gap-2">
            <Button className="min-h-11 flex-1 font-semibold" onClick={onUseLocation}>
              Use my location
            </Button>
            <button type="button" className="border-border bg-card hover:bg-muted min-h-11 flex-1 rounded-xl border px-4 text-sm font-semibold transition" onClick={onNotNow}>
              Not now
            </button>
          </div>
        </div>
      ) : loc.state === "blocked" ? (
        <p className="text-muted-foreground mb-3 text-sm">
          Location is off for mesita.ai. Turn it on in your browser&apos;s site settings.
        </p>
      ) : null}

      {loc.state === "asking" && rows.length === 0 ? (
        <RowsSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={loc.state === "on" ? "No place near you takes Mesita Payments" : "Turn on location to see places near you that take Mesita Payments"}
          description=""
        />
      ) : (
        <>
          <div className="flex min-h-11 items-center justify-between gap-3 px-1">
            <h2 className="text-base font-semibold">Pay at a place</h2>
            {!searchShown ? (
              <button
                type="button"
                aria-label="Search places"
                className="bg-card hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full transition"
                onClick={() => {
                  setSearchOpen(true);
                  requestAnimationFrame(() => document.querySelector<HTMLInputElement>("[data-pay-search] input")?.focus());
                }}
              >
                <Search className="h-[18px] w-[18px]" aria-hidden />
              </button>
            ) : null}
          </div>
          {/* SEARCH'S BAR, NO LOCATION (Pato, MESITA-3702: "Update UI of the
              searchbar. this one must not support locations"): the app's one
              search bar (SearchBar), alone: no locate disc, no Ask AI. White
              on Pay's grey page, where the band's grey fill would vanish;
              typing darkens its border, as on Search. It filters this list
              only, never the catalog: places that take Mesita Payments
              (card_ok), cash with a place code (outside_ok), or where the
              guest holds Credits (pay-places.ts). */}
          {searchShown ? (
          <div data-pay-search className="bg-card focus-within:border-foreground mt-2 flex h-10 items-center rounded-full border border-transparent pr-1 pl-4 transition-colors">
            <SearchBar
              query={query}
              showClear={query.length > 0}
              onQueryChange={setQuery}
              onClear={() => setQuery("")}
              placeholder="Search a place"
            />
          </div>
          ) : null}
          {shown.length === 0 ? (
            <p className="text-muted-foreground mt-4 px-1 text-sm">No place matches &ldquo;{query.trim()}&rdquo;</p>
          ) : (
            <div className="border-border bg-card mt-3 overflow-hidden rounded-2xl border" data-pay-places>
              {shown.map((r, i) => {
                const amount = r.amount ? money(r.amount.cents, r.amount.currency) : null;
                const where = [r.distance_m !== null ? distanceText(r.distance_m) : null, r.address].filter(Boolean).join(" · ");
                const face = (
                  <>
                    <PlacePhoto place={r} className="h-12 w-12" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{r.name}</span>
                      {r.place === null ? (
                        <span className="text-muted-foreground mt-0.5 block truncate text-sm">Credits Card</span>
                      ) : (amount ? where : r.address) ? (
                        <span className="text-muted-foreground mt-0.5 block truncate text-sm">{amount ? where : r.address}</span>
                      ) : null}
                    </span>
                  </>
                );
                const pill = amount ? (
                  <span className="border-border flex items-center gap-1 rounded-full border py-1.5 pr-2 pl-3 text-sm font-semibold tabular-nums">
                    {amount}
                    {r.amount?.pending ? <span className="text-muted-foreground font-normal">pending</span> : null}
                    <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden />
                  </span>
                ) : null;
                return (
                  <Fragment key={r.id}>
                    {i > 0 && <div className="bg-border ml-[4.5rem] h-px" />}
                    {r.place === null ? (
                      // A Credits Card the Pay read does not list: its House Card.
                      <Link
                        href={walletPlacePath(r.id)}
                        aria-label={`${r.name}: ${amount} in credits, open card`}
                        className={cn(ROW_MAIN, "min-h-[4.75rem] pr-4")}
                        data-pay-credits-card
                      >
                        {face}
                        {pill}
                      </Link>
                    ) : (
                      <div className="flex min-h-[4.75rem] items-stretch">
                        <button type="button" onClick={() => onPick(r.id)} className={cn(ROW_MAIN, amount ? "pr-2" : "pr-4")}>
                          {face}
                          {amount ? null : (
                            <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
                              {r.distance_m !== null ? distanceText(r.distance_m) : null}
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            </span>
                          )}
                        </button>
                        {amount ? (
                          // Beside the row's button, never inside it: the amount opens the House Card.
                          <Link
                            href={walletPlacePath(r.id)}
                            aria-label={`${amount}${r.amount?.pending ? " pending" : ""} in credits at ${r.name}, open card`}
                            className="hover:bg-muted/60 flex min-w-11 shrink-0 items-center pr-4 pl-2 transition"
                            data-pay-credits
                          >
                            {pill}
                          </Link>
                        ) : null}
                      </div>
                    )}
                  </Fragment>
                );
              })}
              {hidden > 0 ? (
                <>
                  <div className="bg-border h-px" />
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="hover:bg-muted/60 flex min-h-12 w-full items-center justify-center px-4 text-sm font-semibold transition"
                  >
                    Show all {matches.length} places
                  </button>
                </>
              ) : null}
              {!q ? (
                <>
                  <div className="bg-border ml-[4.75rem] h-px" />
                  <AddRow label="Add a Credits Card" line="Find a place and add its card" href={CONSUMER_ROUTES.search} />
                </>
              ) : null}
            </div>
          )}
        </>
      )}

      {creditsFailed ? (
        <p className="text-muted-foreground mt-1 px-1 text-sm" role="status">
          Couldn&apos;t load your credits.{" "}
          <button type="button" onClick={onRetryCredits} className="text-foreground inline-flex min-h-11 items-center font-semibold underline">
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border" aria-busy>
      {[0, 1, 2].map((i) => (
        <Fragment key={i}>
          {i > 0 && <RowDivider />}
          <div className="flex min-h-14 items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1.5 h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy>
      <RowsSkeleton />
    </div>
  );
}

/** A payment still in progress leads the tab (MESITA-3719): the place, its
 *  state in words, the amount, how it is paid, one button, and the time the
 *  waiter must verify by. Waiting is amber, as on the QR screen it opens. */
function InProgressCard({ tab, place, onOpen }: { tab: GuestTab; place: PayPlace | null; onOpen: () => void }) {
  const m = (c: number) => money(c, tab.currency);
  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const card = tab.card_bill_cents + tab.card_tip_cents;
  const total = tab.credit_cents + cash + card;
  const cardGoing = tab.status === "paying";
  const name = tab.place.name ?? "A Mesita place";
  const status = cardGoing ? "Card going through" : "Waiting for the waiter";
  const ways: Array<{ key: string; icon: React.ReactNode; label: string }> = [];
  if (tab.credit_cents > 0) ways.push({ key: "credit", icon: <Wallet />, label: `Credit · ${m(tab.credit_cents)}` });
  if (card > 0) ways.push({ key: "card", icon: <CreditCard />, label: `Card · ${m(card)}` });
  if (cash > 0) ways.push({ key: "cash", icon: <Banknote />, label: `Cash to the waiter · ${m(cash)}` });
  return (
    <section
      aria-label={`Payment in progress at ${name}, ${m(total)}, ${status.toLowerCase()}`}
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-2xl border-2 p-4",
        cardGoing ? "border-border bg-card" : "border-amber-400 bg-amber-50",
      )}
      data-pay-in-progress
    >
      <div className="flex items-center gap-3">
        {place ? <PlacePhoto place={place} className="h-12 w-12" /> : <span className="bg-muted h-12 w-12 shrink-0 rounded-full" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{name}</span>
          <span
            className={cn(
              "bg-card mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
              cardGoing ? "border-border text-muted-foreground" : "border-amber-400 text-amber-800",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", cardGoing ? "bg-muted-foreground" : "bg-amber-600")} aria-hidden />
            {status}
          </span>
        </span>
        <span className="shrink-0 text-2xl font-semibold tabular-nums">{m(total)}</span>
      </div>
      {ways.map((w) => (
        <span key={w.key} className="flex items-center gap-2.5 text-sm">
          <span className="bg-card flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&>svg]:h-[18px] [&>svg]:w-[18px]" aria-hidden>
            {w.icon}
          </span>
          {w.label}
        </span>
      ))}
      <Button type="button" size="lg" className="min-h-12 w-full gap-2 text-base font-semibold" onClick={onOpen}>
        {cardGoing ? (
          "Open"
        ) : (
          <>
            <QrCode className="h-5 w-5" aria-hidden />
            Show QR to the waiter
          </>
        )}
      </Button>
      {!cardGoing ? <p className="text-muted-foreground text-center text-xs">Verify by {clockTime(tab.expires_at)}</p> : null}
    </section>
  );
}
