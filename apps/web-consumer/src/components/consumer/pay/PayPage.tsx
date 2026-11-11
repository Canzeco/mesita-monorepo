"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, MapPin, QrCode } from "lucide-react";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { TestBand } from "@mesita/place-profile";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiGetTab, type GuestTab } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { payPlacePath, payTabPath } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot, requestUserLocation } from "@/lib/use-user-location";
import { OPEN_TAB_STATUSES, PlacePhoto, readOpenTabId, writeOpenTabId } from "./pay-common";
import { usePayPlaces } from "./use-pay-places";
import { PayWalletHeader } from "./PayWalletHeader";

// THE PAY TAB, /pay (MESITA-3304 credit, MESITA-3305 the card part,
// MESITA-3457 the list, MESITA-3536 its look): the places the guest can pay
// at now, nearest first: "Select a place to pay", a search box, and rows of
// profile photo, name, address and distance, led by the guest's open bill.
// A row is a door: /pay/<placeId> opens that place's bill at the table
// (PayTabScreen, MESITA-3564). The bill and the receipt have their own
// addresses (MESITA-3614): /pay/tab/<id> and /pay/receipt/<id>.
//
// PAY IS ONE HALF OF THE TAB (Pato, 2026-11-11, MESITA-3698: "Divide
// Payments across two sections: Pay and Wallet"): the Pay · Wallet band
// (PayWalletHeader) sits under the header; the Wallet's two rails are
// /wallet's (WalletPage). MESITA-3631 had drawn them under this list.
//
// The location is asked once, after a priming card ("See Mesita Payments
// places near you"), rounded to 3 decimals and sent only to the list read.

/** The location the list read carries, in decimals (~110 m). The server's
 *  twin is LOCATION_DECIMALS in _shared/pay-places.ts. */
const LOCATION_DECIMALS = 3;
/** "Not now" on the location card holds for this browser session. */
const LOCATION_NOT_NOW_KEY = "mesita.pay.location-not-now";

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
  const [openTab, setOpenTab] = useState<GuestTab | null>(null);

  // The list leads with the guest's open bill, read fresh each time.
  useEffect(() => {
    const id = readOpenTabId();
    if (!id) return;
    let cancelled = false;
    void apiGetTab(getSupabase(), id)
      .then((r) => {
        if (cancelled) return;
        if (OPEN_TAB_STATUSES.has(r.tab.status)) {
          setOpenTab(r.tab);
        } else {
          writeOpenTabId(null);
          setOpenTab(null);
        }
      })
      .catch((e) => {
        if (cancelled || !(e instanceof EFError) || (e.status !== 404 && e.status !== 403)) return;
        writeOpenTabId(null);
        setOpenTab(null);
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
      <PayWalletHeader tab="pay" />

      <div className="mt-5 flex flex-col">
        {places ? (
          <PlaceList
            places={places}
            loc={loc}
            openTab={openTab}
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
    </KeptScroll>
  );
}

/** Lower case, no accents: "Cafe" finds "Café". */
function fold(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}


function PlaceList({
  places,
  loc,
  openTab,
  onOpenTab,
  onPick,
  onUseLocation,
  onNotNow,
}: {
  places: PayPlace[];
  loc: Loc;
  /** The guest's open bill at the table, if any (MESITA-3572). */
  openTab: GuestTab | null;
  onOpenTab: (tabId: string) => void;
  onPick: (placeId: string) => void;
  onUseLocation: () => void;
  onNotNow: () => void;
}) {
  const [query, setQuery] = useState("");
  const testMode = places.some((p) => p.test_mode);
  const q = fold(query.trim());
  const shown = q ? places.filter((p) => fold(p.name ?? "").includes(q)) : places;
  return (
    <div className="flex flex-col">
      {testMode ? <TestBand className="mb-3" /> : null}

      {openTab ? (
        <button
          type="button"
          onClick={() => onOpenTab(openTab.tab_id)}
          className="border-foreground bg-card hover:bg-muted/60 mb-4 flex min-h-[4.75rem] w-full items-center gap-3.5 rounded-2xl border-2 px-4 py-3 text-left transition"
          data-pay-open-tab
        >
          <QrCode className="h-6 w-6 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold">Your open bill · {openTab.place.name ?? "A Mesita place"}</span>
            <span className="text-muted-foreground mt-0.5 block truncate text-sm tabular-nums">
              {openTab.status === "waiting_bill"
                ? "Waiting for the bill"
                : openTab.status === "billed"
                ? `Ready to pay · ${money(openTab.bill_cents ?? 0, openTab.currency)}`
                : "Paying"}
            </span>
          </span>
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        </button>
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

      {loc.state === "asking" && places.length === 0 ? (
        <RowsSkeleton />
      ) : places.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={loc.state === "on" ? "No place near you takes Mesita Payments" : "Turn on location to see places near you that take Mesita Payments"}
          description=""
        />
      ) : (
        <>
          <h2 className="px-1 text-base font-semibold">Select a place to pay</h2>
          {/* SEARCH'S BAR, NO LOCATION (Pato, MESITA-3702: "Update UI of the
              searchbar. this one must not support locations"): the app's one
              search bar (SearchBar), alone: no locate disc, no Ask AI. White
              on Pay's grey page, where the band's grey fill would vanish;
              typing darkens its border, as on Search. It filters this list
              only, never the catalog: places that take Mesita Payments
              (card_ok), cash with a place code (outside_ok), or where the
              guest holds Credits (pay-places.ts). */}
          <div className="bg-card focus-within:border-foreground mt-2 flex h-10 items-center rounded-full border border-transparent pr-1 pl-4 transition-colors">
            <SearchBar
              query={query}
              showClear={query.length > 0}
              onQueryChange={setQuery}
              onClear={() => setQuery("")}
              placeholder="Search a place"
            />
          </div>
          {shown.length === 0 ? (
            <p className="text-muted-foreground mt-4 px-1 text-sm">No place matches &ldquo;{query.trim()}&rdquo;</p>
          ) : (
            <div className="border-border bg-card mt-3 overflow-hidden rounded-2xl border" data-pay-places>
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
                    {p.distance_m !== null ? (
                      <span className="text-muted-foreground shrink-0 self-start pt-0.5 text-sm tabular-nums">{distanceText(p.distance_m)}</span>
                    ) : (
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                    )}
                  </button>
                </Fragment>
              ))}
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
