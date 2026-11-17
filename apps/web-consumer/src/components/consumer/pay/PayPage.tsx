"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Clock, MapPin, QrCode } from "lucide-react";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Panel, PanelHeading } from "@/components/shared/Panel";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiCancelTab, apiGetTab, apiListVisits, type GuestTab, TAB_REFUSAL } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { clearGuestDraft, readDraft } from "@/lib/guest-pay-draft";
import { readAmount } from "@mesita/place-profile/lib/money";
import { cn } from "@/lib/utils";
import { payBillPath, payPlacePath } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot, requestUserLocation } from "@/lib/use-user-location";
import { forgetGuestTab, NETWORK_FAILURE, PlacePhoto, QUIET_BUTTON_CLASS, readGuestTabIds } from "./pay-common";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { usePayPlaces } from "./use-pay-places";
import { usePendingTicket } from "./PendingTicketBanner";
import { PayHeader } from "./PayHeader";
import { TicketsShortcut } from "./TicketsShortcut";
import { WalletSection } from "@/components/consumer/wallet/WalletSection";
import { WalletShareGift } from "@/components/consumer/wallet/WalletShareGift";

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
// ONE PAY TAB (Pato, 2026-11-16, MESITA-4199: "MERGE PAY AND WALLET INTO ONE
// PAGE SOMEHOW. TWO PAGES ADD COMPLEXITIES" / "call that page Pay"; mockup
// https://claude.ai/artifact/9hGDgrXYVNabHQKBy72GJr, variant A):
//
//   Pay ........................................ [Tickets]
//   [ search a place ]
//   Buy Credits · Send Gift · Claim Gift · Share Mesita (WalletShareGift;
//           on top since MESITA-4202, last in MESITA-4199)
//   Places: every place you hold credit at, pinned, with its balance chip;
//           then the nearest, up to PLACES_SHOWN; "Show all"
//   Pay with: the card, Cash, Add a card, Loyalty Cards (WalletSection)
//
// The bar is Home · Search · Pay · Me; /wallet forwards here. With a bill
// open, the bill panel replaces the search and the places; Pay with stays.
// Fourth shape of this pair: MESITA-3720 drew the Wallet under the places
// (split the same day, 3722), 3729 made a Pay | Wallet switch, 3886 split
// them again. This one keeps the Wallet near (five places at most above it,
// credit places first) and has no switch.
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

export function PayPage({
  giftToken = null,
}: {
  /** /wallet/gift/<token>: a friend's credit link opens over Pay. */
  giftToken?: string | null;
} = {}) {
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
    <KeptScroll className="scrollbar-thin-dark bg-card flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8 *:shrink-0">
      {/* THE HEADER IS THE TITLE AND TICKETS ONLY (MESITA-4204); the search
          bar lives in the Pay box below. */}
      <PayHeader title="Pay" action={<TicketsShortcut />} />

      {/* THE FOUR BUTTONS ON TOP (Pato, 2026-11-16, MESITA-4202: "move the
          four buttons to the top"): right under the band, in every state;
          they ended the page in MESITA-4199. */}
      <WalletShareGift />

      {/* A bill in progress: the bill itself, one panel (MESITA-4086), in
          the Pay box's place; no amber band on this page. */}
      {openTabs !== null && (openTabs.length > 0 || pending) ? (
        <div className="mt-4 flex flex-col">
          <OpenBillPanel
            tab={openTabs[0] ?? null}
            pending={pending}
            places={places}
            onCancelled={(tabId) =>
              // A copy either way: the re-render re-reads the pending draft.
              setOpenTabs((t) => (t ? t.filter((x) => x.tab_id !== tabId) : t))
            }
          />
        </div>
      ) : (
        // THE PAY BOX (Pato, 2026-11-16, MESITA-4204: "The Pay with the QR
        // must be on its own BOX PAY (NOT THE HEADER THE SEARCHBAR) ... Just
        // one box that contains: Searchbar, Place A, Place B, Place C"): one
        // panel headed by the QR and "Pay", the search bar, then the places
        // as its rows. Every state of the list sits inside it.
        <Panel className="mt-4" data-pay-box>
          <div className="flex min-h-6 items-center gap-2 px-4 pt-4">
            <QrCode className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <PanelHeading>Pay</PanelHeading>
          </div>
          <div className="px-4 pt-3 pb-1">
            <SearchBar
              query={query}
              showClear={query.length > 0}
              onQueryChange={setQuery}
              onClear={() => setQuery("")}
              placeholder="Search a place"
            />
          </div>
          {openTabs === null ? (
            <RowsSkeleton bare />
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
            <div className="p-4">
              <EmptyState
                inline
                icon={QrCode}
                title="Couldn't load Pay"
                description="Check your connection and try again."
                action={{ label: "Try again", onClick: refresh }}
              />
            </div>
          ) : (
            <RowsSkeleton bare />
          )}
        </Panel>
      )}
      <WalletSection giftToken={giftToken} />
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
  // Every place the guest holds credit at, at any distance, then the nearest
  // up to PLACES_SHOWN, so Pay with below is never far (MESITA-4199); a
  // search always lists every match.
  const held = matches.filter((p) => p.available_cents > 0);
  const near = matches.filter((p) => p.available_cents <= 0);
  const shown =
    q || showAll
      ? matches
      : [...held, ...near.slice(0, Math.max(0, PLACES_SHOWN - held.length))];
  const hidden = matches.length - shown.length;
  return (
    <div className="flex flex-col">
      {loc.state === "prime" ? (
        <div className="px-4 py-3">
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
        <p className="text-muted-foreground px-4 py-2 text-sm">
          Location is off for mesita.ai. Turn it on in your browser&apos;s site
          settings.
        </p>
      ) : null}

      {loc.state === "asking" && places.length === 0 ? (
        <RowsSkeleton bare />
      ) : places.length === 0 ? (
        <div className="p-4">
          <EmptyState
            inline
            icon={MapPin}
            title={
              loc.state === "on"
                ? "No place near you takes App Payments"
                : "Turn on location to see places near you that take App Payments"
            }
            description=""
          />
        </div>
      ) : (
        <>
          {shown.length === 0 ? (
            <p className="text-muted-foreground px-4 py-4 text-sm">
              No place matches &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            // The rows run edge to edge inside the Pay box (MESITA-4204):
            // a hairline above each, never a box of their own.
            <div className="mt-2" data-pay-places>
              {shown.map((p, i) => (
                <Fragment key={p.place_id}>
                  <div className={cn("bg-border h-px", i > 0 && "ml-[4.5rem]")} />
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
                      {/* ONE BALANCE ON THE PAGE (MESITA-4204, Pato: "your
                          call"): a place row shows its distance; the credit
                          shows once, on its Loyalty Card under Pay with.
                          MESITA-4199 drew it here too, so Orinoco read twice. */}
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

/** `bare`: rows only, inside the Pay box (MESITA-4204); otherwise the
 *  bordered box the loading frame draws. */
function RowsSkeleton({ bare = false }: { bare?: boolean }) {
  return (
    <div
      className={bare ? "mt-2" : "border-border bg-card overflow-hidden rounded-2xl border"}
      aria-busy
    >
      {[0, 1, 2].map((i) => (
        <Fragment key={i}>
          {i > 0 && <RowDivider />}
          <div className="flex min-h-[4.75rem] items-center gap-3 px-4 py-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
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

/** The Pay box in bones (MESITA-4119, its box since MESITA-4204): the QR
 *  heading, the search bar's shape and three rows. /pay's loading.tsx. */
export function ListSkeleton() {
  return (
    <Panel className="mt-4" aria-busy>
      <div className="flex min-h-6 items-center gap-2 px-4 pt-4">
        <QrCode className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        <PanelHeading>Pay</PanelHeading>
      </div>
      <div className="px-4 pt-3 pb-1">
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
      <RowsSkeleton bare />
    </Panel>
  );
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
  onCancelled,
}: {
  tab: GuestTab | null;
  pending: { placeId: string; name: string | null } | null;
  places: PayPlace[] | null;
  /** The bill is gone: Pay shows its places again. `null` for a draft. */
  onCancelled: (tabId: string | null) => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeId = tab ? tab.place.id : (pending?.placeId ?? "");
  const listed = places?.find((p) => p.place_id === placeId);
  const name = (tab ? tab.place.name : pending?.name) ?? listed?.name ?? null;
  const href = tab ? payBillPath(tab.tab_id) : payPlacePath(placeId);
  const what = tab ? "Waiting for the waiter's signature" : "Bill in progress";
  const draft = tab ? null : readDraft(placeId);
  const currency = tab?.currency ?? listed?.currency ?? "mxn";
  const bill = tab ? tab.bill_cents : draft ? readAmount(draft.amount) : null;
  const tip = tab ? tab.card_tip_cents + tab.cash_tip_cents : null;
  // THE SIGN TIMER (MESITA-4130, Pato: "if sign, add the timer to sign in
  // the outside ticket"): the same countdown as the bill's Sign step, from
  // the server's expires_at, ticking each second while a sent bill waits.
  const [now, setNow] = useState(() => Date.now());
  const waiting = tab !== null && tab.status !== "cancelled" && tab.status !== "expired" && !(tab.status === "paid" && tab.verified_at);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waiting]);
  const secs = tab ? Math.max(0, Math.ceil((Date.parse(tab.expires_at) - now) / 1000)) : 0;
  const countdown = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  async function cancel() {
    if (busy) return;
    setError(null);
    if (!tab) {
      clearGuestDraft(placeId);
      setConfirm(false);
      onCancelled(null);
      return;
    }
    setBusy(true);
    try {
      await apiCancelTab(getSupabase(), tab.tab_id, "cancel");
      forgetGuestTab(tab.tab_id);
      clearGuestDraft(tab.place.id);
      setConfirm(false);
      onCancelled(tab.tab_id);
    } catch (e) {
      const code = e instanceof EFError ? e.code : null;
      setError((code && TAB_REFUSAL[code]) || NETWORK_FAILURE);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="border-amber-200 bg-amber-50 text-amber-900" data-pay-open-bill>
      <div className="flex items-center gap-3 px-4 pt-4">
        <PlacePhoto place={{ photo: listed?.photo ?? null, name }} className="h-11 w-11" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{name ?? "Your bill"}</span>
          <span className="block truncate text-sm text-amber-800">{what}</span>
        </span>
      </div>
      {waiting ? (
        <p className="flex items-center gap-2 px-4 pt-3 text-sm" role="timer" aria-live="off" data-pay-open-bill-timer>
          <Clock className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <span className="text-base font-semibold text-amber-700 tabular-nums">{countdown}</span>
          <span className="text-amber-800">left to sign · if not, it cancels and nothing is charged</span>
        </p>
      ) : null}
      {bill ? (
        <div className="mt-4 divide-y divide-amber-200 border-t border-amber-200 text-base">
          <BillRow label="Bill" value={money(bill, currency)} />
          {tip ? (
            <>
              <BillRow label="Tip" value={money(tip, currency)} />
              <BillRow label="Total" value={money(bill + tip, currency)} strong />
            </>
          ) : null}
        </div>
      ) : null}
      <p className={cn("px-4 text-sm text-amber-900", bill ? "pt-1" : "pt-4")} data-pay-open-bill-warning>
        Finish or cancel this bill before you start a new one.
      </p>
      {error ? (
        <p role="alert" className="px-4 pt-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      {/* ONE ROW, LEFT AND RIGHT (MESITA-4130, Pato: "red cancel and black
          continue, left and right"): the Pay steps' footer shape, red Cancel
          bill a quarter, black Continue three quarters. Cancel asks first. */}
      <div className="grid grid-cols-[1fr_3fr] gap-3 p-4">
        <Button
          type="button"
          size="lg"
          variant="danger"
          className="min-h-12 w-full px-1 text-sm leading-tight font-semibold whitespace-normal"
          onClick={() => setConfirm(true)}
          disabled={busy}
          data-pay-open-bill-cancel
        >
          Cancel bill
        </Button>
        <Button asChild size="lg" className="min-h-12 w-full text-base font-semibold">
          <Link href={href}>Continue</Link>
        </Button>
      </div>
      <LocalDialog open={confirm} onClose={() => setConfirm(false)} ariaLabel="Cancel this bill">
        <div className="p-5">
          <p className="text-base font-semibold">Cancel this bill?</p>
          <p className="text-muted-foreground mt-1 text-sm">Nothing is paid.</p>
          <div className="mt-4 flex gap-2">
            <Button className="min-h-12 flex-1 text-base font-semibold" disabled={busy} onClick={() => void cancel()}>
              {busy ? "Cancelling…" : "Cancel bill"}
            </Button>
            <button type="button" className={cn(QUIET_BUTTON_CLASS, "flex-1")} onClick={() => setConfirm(false)}>
              Keep it
            </button>
          </div>
        </div>
      </LocalDialog>
    </Panel>
  );
}

function BillRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-3 px-4", strong && "font-semibold")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
