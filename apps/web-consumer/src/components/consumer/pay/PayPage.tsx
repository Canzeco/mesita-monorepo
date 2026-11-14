"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, ChevronRight, CreditCard, MapPin, QrCode, Wallet } from "lucide-react";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiGetTab, apiListVisits, type GuestTab } from "@/lib/api/tab";
import { clockTime } from "@mesita/place-profile/lib/money";
import { SIGN } from "@mesita/place-profile/lib/pay-steps";
import { money, type PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { payPlacePath, payTabPath } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { inProgressLabel, pickOpenGuestPayment } from "@/lib/pay-open";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot, requestUserLocation } from "@/lib/use-user-location";
import { forgetGuestTab, PlacePhoto, readGuestTabIds } from "./pay-common";
import { usePayPlaces } from "./use-pay-places";
import { pendingTicketPlace } from "./GuestPayScreen";
import { PayHeader } from "./PayHeader";
import { TicketsShortcut } from "./TicketsShortcut";

// THE PAY TAB, /pay (MESITA-3304 credit, MESITA-3305 the card part,
// MESITA-3457 the list, MESITA-3536 its look): the places the guest can pay
// at now, nearest first: a search bar always shown (Pato,
// MESITA-3725: "searchbar must always be visible"; MESITA-3719 had hidden it
// behind a magnifier up to six places), and rows of
// profile photo, name, address and distance, led by the guest's open bill.
// A row is a door: /pay/<placeId> opens that place's bill at the table
// (PayTabScreen, MESITA-3564). The bill and the receipt have their own
// addresses (MESITA-3614): /pay/tab/<id> and /pay/receipt/<id>.
//
// ONLY PAY (Pato, 2026-11-14, MESITA-3886: "separate pay and wallet again.
// only pay and only wallet"): the title band at the top (PayHeader), then the
// payment in progress and the places (the nearest PLACES_SHOWN, then "Show
// all"). Wallet is its own bar tab again (/wallet). From MESITA-3729 until
// this the band was a Pay | Wallet switch; MESITA-3720 had drawn the Wallet
// under these places on one page, and MESITA-3721 put the credits on the rows.
//
// ONE OPEN PAYMENT (Pato, 2026-11-11, MESITA-3772: "you can only have one
// ticket opened at a time ... in the pay page just display the button to go
// the ticket"): while the guest has a payment of their own open (found on
// the server, so from any device, and on this device's list), the Pay half
// shows only that payment's card and one line; no search bar, no places.
//
// The location is asked once, after a priming card ("See Mesita Payments
// places near you"), rounded to 3 decimals and sent only to the list read.

/** The location the list read carries, in decimals (~110 m). The server's
 *  twin is LOCATION_DECIMALS in _shared/pay-places.ts. */
const LOCATION_DECIMALS = 3;
/** "Not now" on the location card holds for this browser session. */
const LOCATION_NOT_NOW_KEY = "mesita.pay.location-not-now";

/** The guest is at a place this close (MESITA-3861): Pay starts there. */
const AT_PLACE_M = 150;

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

export function PayPage() {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const [loc, setLoc] = useState<Loc>({ state: "unknown" });
  const { places, failed, refresh } = usePayPlaces(loc.state === "on" ? loc.at : null);
  // null while the open payment is still being looked for.
  const [openTabs, setOpenTabs] = useState<GuestTab[] | null>(null);
  // The band's search bar filters the list below (MESITA-3738).
  const [query, setQuery] = useState("");

  // The guest's own payments still in progress (paying, or paid and not yet
  // signed, inside their window), read fresh each time: the one the server
  // names (MESITA-3772, any device) and this device's list (MESITA-3709). A
  // finished one is forgotten. A failed server read falls back to the list.
  useEffect(() => {
    let cancelled = false;
    const local = readGuestTabIds();
    void apiListVisits(getSupabase())
      .then((r) => pickOpenGuestPayment(r.visits, Date.now())?.tab_id ?? null)
      .catch(() => null)
      .then((serverId) => {
        const ids = serverId ? [serverId, ...local.filter((x) => x !== serverId)] : local;
        return Promise.all(
          ids.map((id) =>
            apiGetTab(getSupabase(), id)
              .then((r) => r.tab)
              .catch((e) => {
                if (e instanceof EFError && (e.status === 404 || e.status === 403)) forgetGuestTab(id);
                return null;
              }),
          ),
        );
      })
      .then((tabs) => {
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

  // OPEN (MESITA-3861, "14. Payments Flow Guest-Lead"): one open bill
  // anywhere opens exactly where it was left; otherwise the Pay tab starts
  // with the place the guest is at (the nearest, within AT_PLACE_M), unless
  // they came here to choose another (?pick=1, the name on Open).
  useEffect(() => {
    if (!openTabs) return;
    if (openTabs.length > 0) {
      navigateTo(router, payTabPath(openTabs[0].tab_id), { replace: true });
      return;
    }
    // MESITA-3879: a ticket in progress opens where it was left; no other place.
    const pending = pendingTicketPlace();
    if (pending) {
      navigateTo(router, payPlacePath(pending), { replace: true });
      return;
    }
    if (loc.state !== "on" || !places || places.length === 0) return;
    if (new URLSearchParams(window.location.search).has("pick")) return;
    const near = places.filter((p) => p.distance_m !== null).sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0))[0];
    if (near && (near.distance_m ?? Infinity) <= AT_PLACE_M) navigateTo(router, payPlacePath(near.place_id), { replace: true });
  }, [openTabs, loc, places, router]);

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
    <KeptScroll className="scrollbar-hide bg-card flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8">
      <PayHeader
        title="Pay"
        action={<TicketsShortcut />}
        bar={
          openTabs && openTabs.length === 0 ? (
            <SearchBar
              query={query}
              showClear={query.length > 0}
              onQueryChange={setQuery}
              onClear={() => setQuery("")}
              placeholder="Search a place"
            />
          ) : undefined
        }
      />

      <div className="mt-5 flex flex-col">
        {openTabs === null ? (
          <ListSkeleton />
        ) : openTabs.length > 0 ? (
          // MESITA-3772: one open payment at a time, and nothing else to pick.
          <div className="flex flex-col" data-pay-open-only>
            {openTabs.map((t) => (
              <InProgressCard
                key={t.tab_id}
                tab={t}
                place={places?.find((p) => p.place_id === t.place.id) ?? null}
                onOpen={() => navigateTo(router, payTabPath(t.tab_id), { motion: "push" })}
              />
            ))}
            <p className="text-muted-foreground text-center text-sm">Get this payment signed or close it before paying again.</p>
          </div>
        ) : places ? (
          <PlaceList
            places={places}
            query={query}
            loc={loc}
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
    </KeptScroll>
  );
}

/** Lower case, no accents: "Cafe" finds "Café". */
function fold(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}


function PlaceList({
  places,
  query,
  loc,
  onPick,
  onUseLocation,
  onNotNow,
}: {
  places: PayPlace[];
  /** The search bar's text, from the band (PayHeader, MESITA-3738). */
  query: string;
  loc: Loc;
  onPick: (placeId: string) => void;
  onUseLocation: () => void;
  onNotNow: () => void;
}) {
  const q = fold(query.trim());
  const [showAll, setShowAll] = useState(false);
  const matches = q ? places.filter((p) => fold(p.name ?? "").includes(q)) : places;
  // The nearest PLACES_SHOWN, so the Wallet below is never far (MESITA-3720);
  // a search always lists every match.
  const shown = q || showAll ? matches : matches.slice(0, PLACES_SHOWN);
  const hidden = matches.length - shown.length;
  return (
    <div className="flex flex-col">
      {loc.state === "prime" ? (
        <div className="border-border bg-card mb-3 rounded-2xl border px-4 py-4">
          <p className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            See places near you that take App Payments
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

      {loc.state === "asking" && places.length === 0 ? (
        <RowsSkeleton />
      ) : places.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={loc.state === "on" ? "No place near you takes App Payments" : "Turn on location to see places near you that take App Payments"}
          description=""
        />
      ) : (
        <>
          {shown.length === 0 ? (
            <p className="text-muted-foreground px-1 text-sm">No place matches &ldquo;{query.trim()}&rdquo;</p>
          ) : (
            <div className="border-border bg-card overflow-hidden rounded-2xl border" data-pay-places>
              {shown.map((p, i) => (
                <Fragment key={p.place_id}>
                  {i > 0 && <div className="bg-border ml-[4.5rem] h-px" />}
                  <button
                    type="button"
                    onClick={() => onPick(p.place_id)}
                    className="hover:bg-muted/60 flex min-h-[4.75rem] w-full items-center gap-3.5 px-4 py-3 text-left transition"
                  >
                    <PlacePhoto place={p} className="h-12 w-12" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{p.name ?? "A Mesita place"}</span>
                      {p.address ? <span className="text-muted-foreground mt-0.5 block truncate text-sm">{p.address}</span> : null}
                    </span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
                      {p.distance_m !== null ? distanceText(p.distance_m) : null}
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </span>
                  </button>
                </Fragment>
              ))}
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
            </div>
          )}
        </>
      )}
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
  // From the parts, as the payment's own page reads them: a cash payment
  // that waits for the waiter is never "Card going through".
  const status = inProgressLabel(tab);
  const cardGoing = status === "Card going through";
  const name = tab.place.name ?? "A Mesita place";
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
      {!cardGoing ? <p className="text-muted-foreground text-center text-xs">{SIGN.showWaiterBy(clockTime(tab.expires_at))}</p> : null}
    </section>
  );
}
