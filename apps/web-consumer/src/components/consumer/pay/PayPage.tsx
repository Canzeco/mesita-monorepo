"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, MapPin, QrCode } from "lucide-react";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiGetTab, apiListVisits, type GuestTab } from "@/lib/api/tab";
import { type PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { payPlacePath } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot, requestUserLocation } from "@/lib/use-user-location";
import { forgetGuestTab, PlacePhoto, readGuestTabIds } from "./pay-common";
import { usePayPlaces } from "./use-pay-places";
import { usePendingTicket } from "./PendingTicketBanner";
import { PayHeader } from "./PayHeader";
import { TicketsShortcut } from "./TicketsShortcut";

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
// shows one line; no search bar, no places. The payment's own row is the
// amber band above the tab bar (MESITA-4051), the same on every tab.
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

const round = (v: number) =>
  Math.round(v * 10 ** LOCATION_DECIMALS) / 10 ** LOCATION_DECIMALS;

/** "350 m" / "2.4 km". */
function distanceText(m: number): string {
  return m < 1000
    ? `${Math.max(10, Math.round(m / 10) * 10)} m`
    : `${(m / 1000).toFixed(1)} km`;
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
  const { places, failed, refresh } = usePayPlaces(
    loc.state === "on" ? loc.at : null,
  );
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
        const ids = serverId
          ? [serverId, ...local.filter((x) => x !== serverId)]
          : local;
        return Promise.all(
          ids.map((id) =>
            apiGetTab(getSupabase(), id)
              .then((r) => r.tab)
              .catch((e) => {
                if (
                  e instanceof EFError &&
                  (e.status === 404 || e.status === 403)
                )
                  forgetGuestTab(id);
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
          const open =
            !t.verified_at &&
            Date.parse(t.expires_at) > now &&
            (t.status === "paying" || t.status === "paid");
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
        if (c)
          setLoc({ state: "on", at: { lat: round(c.lat), lng: round(c.lng) } });
        else
          setLoc({
            state: locationSnapshot().error === "denied" ? "blocked" : "off",
          });
      });
    };
    if (have) {
      // Deferred a tick: no state is set inside the effect's own body.
      void Promise.resolve().then(() => {
        if (!cancelled)
          setLoc({
            state: "on",
            at: { lat: round(have.lat), lng: round(have.lng) },
          });
      });
    } else if (
      typeof navigator !== "undefined" &&
      navigator.permissions?.query
    ) {
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

  // OPEN (MESITA-3861, "14. Payments Flow Guest-Lead"): with no ticket open,
  // the Pay tab starts with the place the guest is at (the nearest, within
  // AT_PLACE_M), unless they came here to choose another (?pick=1). A ticket
  // left open is never a redirect (MESITA-3908, Pato: "one thing is closing
  // and other thing is cancelling"): its card leads the page instead.
  const pending = usePendingTicket();
  const hasPending = pending !== null;
  useEffect(() => {
    if (!openTabs || openTabs.length > 0 || hasPending) return;
    if (loc.state !== "on" || !places || places.length === 0) return;
    if (new URLSearchParams(window.location.search).has("pick")) return;
    const near = places
      .filter((p) => p.distance_m !== null)
      .sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0))[0];
    if (near && (near.distance_m ?? Infinity) <= AT_PLACE_M)
      navigateTo(router, payPlacePath(near.place_id), { replace: true });
  }, [openTabs, hasPending, loc, places, router]);

  function askLocation() {
    setLoc({ state: "asking" });
    void requestUserLocation().then((c) => {
      if (c)
        setLoc({ state: "on", at: { lat: round(c.lat), lng: round(c.lng) } });
      else
        setLoc({
          state: locationSnapshot().error === "denied" ? "blocked" : "off",
        });
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
          openTabs && openTabs.length === 0 && !pending ? (
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

      {/* A bill in progress (MESITA-4051, Pato: "put it at the very bottom
          of the app"): its row is the amber band above the tab bar
          (PendingTicketBanner), as on every tab; the page says one line. */}
      <div
        className={cn(
          "mt-5 flex flex-col",
          openTabs !== null &&
            (openTabs.length > 0 || pending) &&
            "flex-1 justify-center pb-16",
        )}
      >
        {openTabs === null ? (
          <ListSkeleton />
        ) : openTabs.length > 0 || pending ? (
          <p
            className="text-muted-foreground text-center text-sm"
            data-pay-open-only
          >
            Finish this bill before starting another.
          </p>
        ) : places ? (
          <PlaceList
            places={places}
            query={query}
            loc={loc}
            onPick={(id) =>
              navigateTo(router, payPlacePath(id), { motion: "push" })
            }
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
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
  const matches = q
    ? places.filter((p) => fold(p.name ?? "").includes(q))
    : places;
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
            <Button
              className="min-h-11 flex-1 font-semibold"
              onClick={onUseLocation}
            >
              Use my location
            </Button>
            <button
              type="button"
              className="border-border bg-card hover:bg-muted min-h-11 flex-1 rounded-xl border px-4 text-sm font-semibold transition"
              onClick={onNotNow}
            >
              Not now
            </button>
          </div>
        </div>
      ) : loc.state === "blocked" ? (
        <p className="text-muted-foreground mb-3 text-sm">
          Location is off for mesita.ai. Turn it on in your browser&apos;s site
          settings.
        </p>
      ) : null}

      {loc.state === "asking" && places.length === 0 ? (
        <RowsSkeleton />
      ) : places.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={
            loc.state === "on"
              ? "No place near you takes App Payments"
              : "Turn on location to see places near you that take App Payments"
          }
          description=""
        />
      ) : (
        <>
          {shown.length === 0 ? (
            <p className="text-muted-foreground px-1 text-sm">
              No place matches &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            <div
              className="border-border bg-card overflow-hidden rounded-2xl border"
              data-pay-places
            >
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
                      <span className="block truncate text-base font-semibold">
                        {p.name ?? "A Mesita place"}
                      </span>
                      {p.address ? (
                        <span className="text-muted-foreground mt-0.5 block truncate text-sm">
                          {p.address}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
                      {p.distance_m !== null
                        ? distanceText(p.distance_m)
                        : null}
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
    <div
      className="border-border bg-card overflow-hidden rounded-2xl border"
      aria-busy
    >
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
