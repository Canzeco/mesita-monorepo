"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, CreditCard, MapPin, QrCode, Search, Wallet as WalletIcon, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cashbackFor, paySplit, PlaceMarks, SizedImg, TestBand } from "@mesita/place-profile";
import { amountText, clockTime, readAmount } from "@mesita/place-profile/lib/money";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { LiveClock } from "./LiveClock";
import { TabView, type TabStart } from "./TabView";
import { EFError } from "@/lib/api/_invoke";
import { apiGetTab, type GuestTab } from "@/lib/api/tab";
import {
  apiGetPayment,
  apiListPayPlaces,
  apiLookCharge,
  apiReleasePayment,
  apiStartPayment,
  attemptFor,
  CHARGE_REFUSAL,
  money,
  PAY_REFUSAL,
  type PayAttempt,
  type PayPlace,
  type PayProof,
  type WaiterCharge,
} from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot, requestUserLocation } from "@/lib/use-user-location";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// THE PAY TAB (MESITA-3304 credit, MESITA-3305 the card part, MESITA-3457
// the list, MESITA-3536 the list's look and the steps). The list of places
// the guest can pay at now (consumer-web-list-pay-places, nearest first):
// "Select a place to pay", a search box, and rows of profile photo, name,
// address and distance. A place opens its bill at the table (MESITA-3564,
// TabView.tsx): the QR the waiter scans, the waiter's bill, the guest's
// split of credit and cash, Paid. "Waiter gave you a code?" on the QR keeps
// the older door: a sheet over the list, one question a step: the bill, the tip (only where the place takes a card), pay the bill
// with (Card, or Credit there: credit first, the card the rest), pay the
// tip with (Card; tips go by card), then the summary and "Go to checkout"
// (or "Pay … with credit"). Then the proof. Every amount shown is a server
// field or the shared paySplit twin the server's own rule is tested
// against; the server is the last word.
//
// The location is asked once, after a priming card ("See Mesita Pay places
// near you"), rounded to 3 decimals and sent only to the list read. The
// table QR opens `/pay?place=<id>`: the shell's sign-in wall carries it
// through sign-in, and that place's bill opens, or the list says the place
// isn't taking Mesita Pay.
//
// The paid state is the address: `/pay?payment=<id>` (set with
// replaceState), so a reload or a Wallet "Paid" row shows the same proof.
// The proof (MESITA-3459): the big figure is amount + tip ("MX$300 + MX$30
// tip" under it), then the place, "Paid · HH:mm", a live clock
// (aria-hidden), the ticket when the server sends it, and the QR last.
// While unseen the page reads the payment every 5 s while visible, stops on
// Seen, while hidden or after 15 minutes, and reads once on becoming visible
// again; "Paid" swaps to "Seen · HH:mm" in a polite live region. Two failed
// reads grey the line with "Reconnecting"; a 403/404 stops polling with
// "This payment isn't on your account".
//
// Back from a cancelled Checkout (MESITA-3458): Stripe returns to
// `/pay?payment=<id>&checkout=cancel`. The page releases it first
// (consumer-web-release-payment expires the session and frees the held
// credit) and shows the form again with the same place, amount, tip and
// ticket and a quiet "Payment cancelled". A paid return reads "Confirming…"
// for 30 s, then "Still confirming" with Refresh; "Payment didn't go
// through" only when the server says expired or failed.

const PAYMENT_PARAM = "payment";
const CHECKOUT_PARAM = "checkout";
const CHECKOUT_CANCEL = "cancel";
const PLACE_PARAM = "place";
/** The open bill at the table (MESITA-3564): `/pay?tab=<id>` survives a reload. */
const TAB_PARAM = "tab";
/** How long a paid return reads "Confirming…" before "Still confirming". */
const CONFIRM_PATIENCE_MS = 30_000;
/** The proof re-reads the payment this often while visible (MESITA-3459). */
const POLL_MS = 5_000;
/** ...and stops after this long; becoming visible again reads once. */
const POLL_STOP_AFTER_MS = 15 * 60_000;
const NETWORK_FAILURE = "Couldn't reach Mesita. Tap again.";
/** The location the list read carries, in decimals (~110 m). The server's
 *  twin is LOCATION_DECIMALS in _shared/pay-places.ts. */
const LOCATION_DECIMALS = 3;
/** "Not now" on the location card holds for this browser session. */
const LOCATION_NOT_NOW_KEY = "mesita.pay.location-not-now";
const NOT_TAKING = "This place isn't taking Mesita Pay right now";
/** The guest's open bill at the table (MESITA-3572): its id stays on this
 *  device so the Pay list can lead with it. The server is the truth: a bill
 *  that reads paid, expired or cancelled is forgotten. */
const OPEN_TAB_KEY = "mesita.pay.open-tab";
const OPEN_TAB_STATUSES = new Set(["waiting_bill", "billed", "paying"]);

function readOpenTabId(): string | null {
  try {
    return window.localStorage.getItem(OPEN_TAB_KEY);
  } catch {
    return null;
  }
}

function writeOpenTabId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(OPEN_TAB_KEY, id);
    else window.localStorage.removeItem(OPEN_TAB_KEY);
  } catch {
    // Private mode or blocked storage: the list just doesn't lead with it.
  }
}

const FIELD_CLASS =
  "border-border bg-background text-foreground placeholder:text-muted-foreground h-12 w-full rounded-xl border px-3 text-base outline-none focus:border-foreground";
/** The quiet second button under the pink one: Resume a Checkout, Done
 *  while one is open. */
const QUIET_BUTTON_CLASS =
  "border-border bg-card hover:bg-muted min-h-12 w-full rounded-2xl border px-4 text-base font-semibold transition";

/** A 403 or 404 on the read: the payment is not this guest's. */
const isGone = (e: unknown) => e instanceof EFError && (e.status === 403 || e.status === 404);

const noSubscribe = () => () => {};

function setParam(name: string, value: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(name, value);
  else params.delete(name);
  if (name === PAYMENT_PARAM) params.delete(CHECKOUT_PARAM);
  const q = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
}
const setPaymentParam = (id: string | null) => setParam(PAYMENT_PARAM, id);

/** What the form shows again after a cancelled Checkout. */
type Refill = { placeId: string; amountCents: number; tipCents: number; ticket: string };

/** A payment that is neither settled nor closed: the page keeps confirming. */
const isOpen = (p: PayProof) => p.status === "open" || p.status === "opening";

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
  const getSupabase = useLazyBrowserSupabase();
  // Read once on the client so a load with ?payment= draws the proof's
  // skeleton, never the list; the server render reads "".
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  const askedPayment = new URLSearchParams(search).get(PAYMENT_PARAM);
  const askedTab = new URLSearchParams(search).get(TAB_PARAM);

  const [places, setPlaces] = useState<PayPlace[] | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [listNonce, setListNonce] = useState(0);
  const [proof, setProof] = useState<PayProof | null>(null);
  const [proofDone, setProofDone] = useState(false);
  const [refill, setRefill] = useState<Refill | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetClosed, setSheetClosed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loc, setLoc] = useState<Loc>({ state: "unknown" });
  const askedPlace = useRef<string | null | undefined>(undefined);
  // Pay at the table (MESITA-3564): picking a place opens its bill (the QR
  // the waiter scans); a reload of `/pay?tab=<id>` shows the same bill.
  const [tabPicked, setTabPicked] = useState<TabStart | null>(null);
  const [tabLeft, setTabLeft] = useState(false);
  const tabStart: TabStart | null = tabPicked ?? (askedTab && !tabLeft ? { kind: "tab", tabId: askedTab } : null);
  const inTab = tabStart !== null;
  const [openTab, setOpenTab] = useState<GuestTab | null>(null);

  // The list leads with the guest's open bill, read fresh each time the
  // list shows.
  useEffect(() => {
    if (inTab) return;
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
    // getSupabase is a new function each render (useLazyBrowserSupabase):
    // listing it would re-read in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inTab, listNonce]);

  // Boot: a ?payment= load reads that payment (or releases a cancelled
  // Checkout); otherwise the list loads.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const id = params.get(PAYMENT_PARAM);
    if (!id || proofDone) return;
    const cancelledCheckout = params.get(CHECKOUT_PARAM) === CHECKOUT_CANCEL;
    const read = cancelledCheckout
      ? apiReleasePayment(getSupabase(), id).then((r) => {
        if (r.payment.status === "expired" || r.payment.status === "failed") {
          if (!cancelled && r.place_id) {
            setRefill({
              placeId: r.place_id,
              amountCents: r.payment.amount_cents,
              tipCents: r.payment.tip_cents ?? 0,
              ticket: r.ticket ?? "",
            });
            setOpenId(r.place_id);
            setSheetClosed(false);
          }
          return null;
        }
        return r.payment;
      })
      : apiGetPayment(getSupabase(), id);
    void read
      .then((p) => {
        if (cancelled) return;
        if (p) {
          setProof(p);
          return;
        }
        setPaymentParam(null);
        setProofDone(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setPaymentParam(null);
        if (isGone(e)) toast("This payment isn't on your account", { tone: "error" });
        else if (e instanceof EFError && e.code) toast("That payment isn't here.", { tone: "error" });
        else toast(NETWORK_FAILURE, { tone: "error" });
        setProofDone(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proofDone]);

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

  const at = loc.state === "on" ? loc.at : null;
  const atKey = at ? `${at.lat},${at.lng}` : "";

  // The list: read without a location at once (credit places need none),
  // and again when a location arrives.
  useEffect(() => {
    if (askedPayment && !proofDone) return;
    let cancelled = false;
    void apiListPayPlaces(getSupabase(), at)
      .then((list) => {
        if (cancelled) return;
        setPlaces(list);
        setListFailed(false);
        // The table QR's place, once: open its form, or say why not.
        if (askedPlace.current === undefined) {
          askedPlace.current = new URLSearchParams(window.location.search).get(PLACE_PARAM);
          if (askedPlace.current) {
            const hit = list.find((p) => p.place_id === askedPlace.current);
            if (hit) setTabPicked({ kind: "place", placeId: hit.place_id });
            else setNotice(NOT_TAKING);
            setParam(PLACE_PARAM, null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setListFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listNonce, atKey, proofDone]);

  const refresh = useCallback(() => setListNonce((n) => n + 1), []);

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

  function showProof(p: PayProof) {
    setPaymentParam(p.payment_id);
    setProof(p);
    setProofDone(false);
  }

  function openPayment(id: string) {
    void apiGetPayment(getSupabase(), id)
      .then(showProof)
      .catch(() => toast(NETWORK_FAILURE, { tone: "error" }));
  }

  function done() {
    setRefill(null);
    setOpenId(null);
    setPaymentParam(null);
    setProof(null);
    setProofDone(true);
    refresh();
  }

  function leaveTab() {
    setOpenTab(null);
    setTabPicked(null);
    setTabLeft(true);
    setParam(TAB_PARAM, null);
    refresh();
  }

  const open = openId && places ? places.find((p) => p.place_id === openId) ?? null : null;
  // Closing keeps the place in the sheet while it slides away; picking a
  // place (or the table QR, or a cancelled Checkout) opens it again.
  const sheetPlace = open;
  const closeSheet = () => {
    setSheetClosed(true);
    setRefill(null);
  };

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Pay</h1>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        {proof ? (
          <ProofView proof={proof} onChange={setProof} onDone={done} />
        ) : tabStart ? (
          <TabView
            key={tabStart.kind === "tab" ? tabStart.tabId : tabStart.placeId}
            start={tabStart}
            getSupabase={getSupabase}
            canUseCode={(placeId) => places?.some((p) => p.place_id === placeId) ?? false}
            onTabId={(id) => {
              setParam(TAB_PARAM, id);
              writeOpenTabId(id);
            }}
            onWaiterCode={(placeId) => {
              leaveTab();
              setOpenId(placeId);
              setSheetClosed(false);
            }}
            onDone={leaveTab}
          />
        ) : askedPayment && !proofDone ? (
          <ProofSkeleton />
        ) : places ? (
          <PlaceList
            places={places}
            loc={loc}
            notice={notice}
            openTab={openTab}
            onOpenTab={(id) => {
              setNotice(null);
              setParam(TAB_PARAM, id);
              setTabPicked({ kind: "tab", tabId: id });
            }}
            onPick={(id) => {
              setNotice(null);
              setTabPicked({ kind: "place", placeId: id });
            }}
            onUseLocation={askLocation}
            onNotNow={notNow}
          />
        ) : listFailed ? (
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

      <LocalSheet open={open !== null && !sheetClosed && !proof} onClose={closeSheet} ariaLabel={`Pay at ${sheetPlace?.name ?? "a Mesita place"}`}>
        {sheetPlace ? (
          <PayForm
            key={sheetPlace.place_id}
            place={sheetPlace}
            refill={refill && refill.placeId === sheetPlace.place_id ? refill : null}
            onBack={closeSheet}
            onPaid={showProof}
            onTaken={openPayment}
            onRefresh={refresh}
          />
        ) : null}
      </LocalSheet>
    </div>
  );
}

// ── The list ─────────────────────────────────────────────────────────────────

/** Lower case, no accents: "Cafe" finds "Café". */
function fold(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** The place's round profile picture, or its first letter. */
function PlacePhoto({ place, className }: { place: PayPlace; className: string }) {
  return (
    <span className={cn("bg-muted shrink-0 overflow-hidden rounded-full ring-1 ring-black/5", className)} aria-hidden>
      {place.photo ? (
        <SizedImg src={place.photo} size="thumb" alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="text-muted-foreground flex h-full w-full items-center justify-center text-base font-semibold">
          {(place.name ?? "M").trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function PlaceList({
  places,
  loc,
  notice,
  openTab,
  onOpenTab,
  onPick,
  onUseLocation,
  onNotNow,
}: {
  places: PayPlace[];
  loc: Loc;
  notice: string | null;
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
      {notice ? (
        <p className="border-border bg-card mb-3 rounded-2xl border px-4 py-3 text-sm font-semibold" role="status">
          {notice}
        </p>
      ) : null}

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
            See Mesita Pay places near you
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
          title={loc.state === "on" ? "No Mesita Pay place near you" : "Turn on location to see Mesita Pay places near you"}
          description=""
        />
      ) : (
        <>
          <h2 className="px-1 text-base font-semibold">Select a place to pay</h2>
          <label className="border-border bg-card mt-2 flex h-12 items-center gap-2.5 rounded-2xl border px-3.5">
            <Search className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a place"
              aria-label="Search a place"
              autoComplete="off"
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
            />
          </label>
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

// ── The form ─────────────────────────────────────────────────────────────────

/** The tip buttons, in percent of the bill (MESITA-3536). */
const TIP_PERCENTS = [10, 15, 20] as const;
type TipChoice = (typeof TIP_PERCENTS)[number] | "other" | "none";
type Step = "bill" | "tip" | "billWith" | "tipWith";
type BillWith = "credit" | "card";

const STEP_TITLE: Record<Step, string> = {
  bill: "How much is the bill?",
  tip: "Add a tip?",
  billWith: "Pay the bill with",
  tipWith: "Pay the tip with",
};

/** One choice in "Pay … with": a radio row, greyed with its reason when off. */
function MethodRow({
  name,
  icon: Icon,
  title,
  note,
  checked,
  disabled,
  onPick,
}: {
  name: string;
  icon: typeof CreditCard;
  title: string;
  note: string;
  checked: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <label className={cn("flex min-h-[4.75rem] items-center gap-3.5 px-4 py-3", checked && "bg-muted/60", disabled ? "opacity-50" : "cursor-pointer")}>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", checked ? "bg-foreground text-background" : "bg-muted")}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="text-muted-foreground mt-0.5 block text-sm">{note}</span>
      </span>
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onPick}
        className="accent-foreground h-5 w-5 shrink-0"
      />
    </label>
  );
}

function PayForm({
  place,
  refill,
  onBack,
  onPaid,
  onTaken,
  onRefresh,
}: {
  place: PayPlace;
  /** The cancelled Checkout's amount, tip and ticket (MESITA-3458). */
  refill: Refill | null;
  onBack: () => void;
  onPaid: (p: PayProof) => void;
  onTaken: (paymentId: string) => void;
  onRefresh: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  // The steps (MESITA-3536): the bill, the tip (only where the place takes a
  // card: a tip goes by card), how to pay the bill, how to pay the tip, and
  // there the summary and the button.
  const steps: Step[] = place.card_ok ? ["bill", "tip", "billWith", "tipWith"] : ["bill", "billWith"];
  const [step, setStep] = useState(() => (refill ? steps.length - 1 : 0));
  const [amount, setAmount] = useState(() => (refill ? amountText(refill.amountCents) : ""));
  const [tipChoice, setTipChoice] = useState<TipChoice | null>(() => (refill ? (refill.tipCents > 0 ? "other" : "none") : null));
  const [tip, setTip] = useState(() => (refill && refill.tipCents > 0 ? amountText(refill.tipCents) : ""));
  // Credit first while the guest holds some here; else the card.
  const [billWith, setBillWith] = useState<BillWith>(() => (!place.card_ok || place.available_cents > 0 ? "credit" : "card"));
  const [ticket, setTicket] = useState(() => refill?.ticket ?? "");
  const [cancelNote, setCancelNote] = useState(refill !== null);
  const [creditChanged, setCreditChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState<string | null>(null);
  const attempt = useRef<PayAttempt | null>(null);
  // The waiter's charge (MESITA-3306): no code field until the guest asks
  // for it; a right code sets the amount and the ticket, read-only.
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [charge, setCharge] = useState<WaiterCharge | null>(null);
  const [looking, setLooking] = useState(false);

  const at = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;
  const cents = charge ? charge.amount_cents : readAmount(amount);
  // A percent button is a share of the bill the guest picked, worked out
  // here; the server checks the card + tip it is sent.
  const tipTyped = !place.card_ok
    ? 0
    : typeof tipChoice === "number"
    ? cents === null ? 0 : Math.round((cents * tipChoice) / 100)
    : tipChoice === "other"
    ? readAmount(tip)
    : 0;
  const tipBad = tipChoice === "other" && tip.trim() !== "" && tipTyped === null;
  const tipCents = tipTyped ?? 0;
  const split = cents === null || cents <= 0
    ? null
    : paySplit({
      amountCents: cents,
      tipCents,
      // "Card" is a card part of the whole bill: no credit used.
      availableCents: billWith === "credit" ? place.available_cents : 0,
      cardOk: place.card_ok,
      minCents: place.card_min_cents,
    });
  const card = split?.kind === "card" ? split : null;
  const total = card ? card.credit_cents + card.card_cents + card.tip_cents : (cents ?? 0);
  const earn = card ? cashbackFor(card.card_cents, place.cashback_bps) : 0;
  const m = (c: number) => money(c, place.currency);

  const amountBad = amount.trim() !== "" && cents === null;
  const reason = at === "bill"
    ? amountBad ? "Type an amount like 250 or 250.50" : null
    : at === "tip"
    ? tipBad ? "Type a tip like 30 or 30.50" : null
    : split?.kind === "over"
    ? `More than your ${m(place.available_cents)} of credit here`
    : split?.kind === "below_minimum"
    ? `Card payments start at ${m(split.minimum_cents)}`
    : null;
  const canPay = split !== null && (split.kind === "credit" || split.kind === "card") && !tipBad && !busy && !looking;
  const canNext = at === "bill"
    ? cents !== null && cents > 0 && !looking
    : at === "tip"
    ? tipChoice !== null && !tipBad
    : canPay;

  /** A refusal of the waiter's code: true when handled here. */
  function chargeRefused(e: EFError): boolean {
    const body = e.body ?? {};
    if (e.code === "taken" && typeof body.payment_id === "string") {
      onTaken(body.payment_id);
      return true;
    }
    if (e.code === "locked" && typeof body.retry_after_s === "number") {
      toast(`${CHARGE_REFUSAL.locked} Try again in ${Math.ceil(body.retry_after_s / 60)} min.`, { tone: "error" });
      return true;
    }
    if (e.code === "gone" || e.code === "taken") {
      toast(CHARGE_REFUSAL[e.code], { tone: "error" });
      setCharge(null);
      setCode("");
      return true;
    }
    return false;
  }

  async function look(typed: string) {
    setLooking(true);
    try {
      const c = await apiLookCharge(getSupabase(), place.place_id, typed);
      attempt.current = null;
      setCharge(c);
      setAmount(amountText(c.amount_cents));
      setCreditChanged(false);
    } catch (e) {
      if (!(e instanceof EFError) || !e.code || !chargeRefused(e)) {
        toast(e instanceof EFError && e.code ? PAY_REFUSAL[e.code] ?? e.message : NETWORK_FAILURE, { tone: "error" });
      }
    } finally {
      setLooking(false);
    }
  }

  async function pay() {
    if (!split || !canPay || cents === null) return;
    const a = attemptFor(attempt.current, place.place_id, total);
    attempt.current = a;
    setBusy(true);
    setResume(null);
    setCancelNote(false);
    try {
      const started = await apiStartPayment(getSupabase(), {
        place_id: place.place_id,
        place_name: place.name,
        place_marks: place.marks,
        amount_cents: cents,
        ...(card ? { card_cents: card.card_cents, tip_cents: card.tip_cents, return_url: `${window.location.origin}${CONSUMER_ROUTES.pay}` } : {}),
        request_id: a.requestId,
        ticket: charge ? charge.ticket : ticket.trim() || null,
        ...(charge ? { charge_code: code } : {}),
      });
      attempt.current = null;
      if (started.kind === "checkout") {
        // The card part: Stripe's page, then back to /pay?payment=<id>.
        setPaymentParam(started.payment_id);
        window.location.assign(started.url);
        return;
      }
      if (started.kind === "already_paid") {
        onTaken(started.payment_id);
        return;
      }
      onPaid(started.proof);
    } catch (e) {
      if (!(e instanceof EFError) || !e.code) {
        // No verdict: the payment may have gone through. Keep the id, so
        // the next tap replays to it instead of paying twice.
        toast(NETWORK_FAILURE, { tone: "error" });
        return;
      }
      attempt.current = null;
      const body = e.body ?? {};
      if (charge && chargeRefused(e)) return;
      if (e.code === "taken" && typeof body.payment_id === "string") {
        onTaken(body.payment_id);
        return;
      }
      if (e.code === "insufficient" || e.code === "below_minimum") {
        // The credit moved under the form: re-read, and back to "Pay the
        // bill with" with the new split.
        setCreditChanged(true);
        setStep(steps.indexOf("billWith"));
        onRefresh();
        return;
      }
      if (e.code === "in_progress") {
        // A Checkout of this guest here is still open: resume it, never
        // a second one behind it.
        if (typeof body.url === "string") setResume(body.url);
        else if (typeof body.payment_id === "string") onTaken(body.payment_id);
        toast(PAY_REFUSAL.in_progress, { tone: "error" });
        return;
      }
      if (e.code === "locked" && typeof body.retry_after_s === "number") {
        toast(`${PAY_REFUSAL.locked} Try again in ${Math.ceil(body.retry_after_s / 60)} min.`, { tone: "error" });
        return;
      }
      toast(PAY_REFUSAL[e.code] ?? e.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const payLabel = !split || cents === null
    ? "Pay"
    : card
    ? `Go to checkout · ${m(total)}`
    : `Pay ${m(cents)} with credit`;
  const title = at === "billWith" && cents !== null
    ? `Pay the ${m(cents)} bill with`
    : at === "tipWith" && tipCents > 0
    ? `Pay the ${m(tipCents)} tip with`
    : at === "tipWith"
    ? "Check and pay"
    : STEP_TITLE[at];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-pay-sheet>
      <div className="flex items-center justify-between px-2 pt-1">
        <button
          type="button"
          aria-label={step > 0 ? "Back" : "Back to places"}
          onClick={() => (step > 0 ? setStep(step - 1) : onBack())}
          className="hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-muted-foreground text-sm font-medium">
          Step {step + 1} of {steps.length}
        </span>
        <button type="button" aria-label="Close" onClick={onBack} className="hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="mt-2 grid gap-1.5 px-4" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-hidden>
        {steps.map((s, i) => (
          <span key={s} className={cn("h-1 rounded-full", i <= step ? "bg-foreground" : "bg-border")} />
        ))}
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {place.test_mode ? <TestBand className="mb-3" /> : null}
        <div className="flex items-center gap-3">
          <PlacePhoto place={place} className="h-11 w-11" />
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold">{place.name ?? "A Mesita place"}</span>
            {place.address ? <span className="text-muted-foreground mt-0.5 block truncate text-sm">{place.address}</span> : null}
          </span>
        </div>
        {cancelNote ? (
          <p className="text-muted-foreground mt-3 text-sm" role="status">
            Payment cancelled
          </p>
        ) : null}

        <h2 className={cn("mt-6 text-xl font-semibold", (at === "bill" || at === "tip") && "text-center")}>{title}</h2>

        {at === "bill" ? (
          <>
            <p className="text-muted-foreground mt-1 text-center text-sm">The total on your check, before tip</p>
            <label className="border-foreground mx-auto mt-6 flex w-60 items-baseline justify-center gap-1.5 border-b-2 pb-2" htmlFor="pay-amount">
              <span className="text-muted-foreground text-4xl font-semibold">$</span>
              <input
                id="pay-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                readOnly={charge !== null}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setCreditChanged(false);
                }}
                className="placeholder:text-muted-foreground/50 w-36 min-w-0 bg-transparent text-4xl font-semibold tabular-nums outline-none"
                aria-label="Bill amount"
              />
              <span className="text-muted-foreground text-base font-semibold">{place.currency.toUpperCase()}</span>
            </label>
            {charge ? (
              <p className="text-muted-foreground mt-3 text-center text-sm" data-waiter-charge>
                The waiter&apos;s charge{charge.ticket ? ` · Ticket ${charge.ticket}` : ""} ·{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setCharge(null);
                    setCode("");
                    setAmount("");
                    attempt.current = null;
                  }}
                >
                  Not this code
                </button>
              </p>
            ) : null}

            {charge ? null : (
              <>
                <label className="mt-8 block text-sm font-semibold" htmlFor="pay-ticket">
                  Check or table no. <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="pay-ticket"
                  autoComplete="off"
                  maxLength={32}
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  className={cn(FIELD_CLASS, "mt-1.5")}
                />
                {codeOpen ? (
                  <>
                    <label className="mt-4 block text-sm font-semibold" htmlFor="pay-charge-code">
                      Waiter&apos;s code
                    </label>
                    <input
                      id="pay-charge-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={4}
                      placeholder="0000"
                      value={code}
                      disabled={looking}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setCode(v);
                        if (v.length === 4) void look(v);
                      }}
                      className={cn(FIELD_CLASS, "mt-1.5 tracking-[0.3em] tabular-nums")}
                    />
                  </>
                ) : (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground mt-3 flex min-h-11 items-center text-sm font-semibold underline"
                    onClick={() => setCodeOpen(true)}
                    data-charge-code-link
                  >
                    Waiter gave you a code?
                  </button>
                )}
              </>
            )}
          </>
        ) : null}

        {at === "tip" ? (
          <>
            <p className="text-muted-foreground mt-1 text-center text-sm">It all goes to the staff, by card</p>
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {TIP_PERCENTS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  aria-pressed={tipChoice === pct}
                  onClick={() => setTipChoice(pct)}
                  className={cn(
                    "flex h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border transition",
                    tipChoice === pct ? "border-foreground bg-muted/60 border-2" : "border-border hover:bg-muted/60",
                  )}
                >
                  <span className="text-base font-semibold">{pct}%</span>
                  <span className="text-muted-foreground text-sm tabular-nums">{cents !== null ? m(Math.round((cents * pct) / 100)) : ""}</span>
                </button>
              ))}
              <button
                type="button"
                aria-pressed={tipChoice === "other"}
                onClick={() => setTipChoice("other")}
                className={cn(
                  "flex h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border transition",
                  tipChoice === "other" ? "border-foreground bg-muted/60 border-2" : "border-border hover:bg-muted/60",
                )}
              >
                <span className="text-base font-semibold">Other</span>
                <span className="text-muted-foreground text-sm">Type it</span>
              </button>
            </div>
            {tipChoice === "other" ? (
              <input
                id="pay-tip"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                placeholder="Tip"
                aria-label="Tip"
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                className={cn(FIELD_CLASS, "mt-3 tabular-nums")}
              />
            ) : null}
            <button
              type="button"
              aria-pressed={tipChoice === "none"}
              onClick={() => setTipChoice("none")}
              className={cn(
                "mt-3 flex min-h-11 w-full items-center justify-center rounded-2xl text-base font-semibold",
                tipChoice === "none" ? "border-foreground border-2" : "text-muted-foreground",
              )}
            >
              No tip
            </button>
          </>
        ) : null}

        {at === "billWith" ? (
          <>
            {creditChanged ? (
              <p className="mt-2 text-sm font-semibold" role="status">
                Your credit changed
              </p>
            ) : null}
            <div className="border-border mt-4 overflow-hidden rounded-2xl border" role="radiogroup" aria-label="Pay the bill with">
              <MethodRow
                name="pay-bill-with"
                icon={CreditCard}
                title="Card"
                note={
                  !place.card_ok
                    ? "This place takes credit only"
                    : place.cashback_bps > 0
                    ? `Card, Apple Pay or Google Pay · ${place.cashback_bps / 100}% back as credit here`
                    : "Card, Apple Pay or Google Pay"
                }
                checked={billWith === "card"}
                disabled={!place.card_ok}
                onPick={() => setBillWith("card")}
              />
              <div className="bg-border h-px" />
              <MethodRow
                name="pay-bill-with"
                icon={WalletIcon}
                title={`Credit at ${place.name ?? "this place"}`}
                note={`You have ${m(place.available_cents)} here${place.pending_cents > 0 ? ` · ${m(place.pending_cents)} pending` : ""}`}
                checked={billWith === "credit"}
                disabled={place.available_cents <= 0}
                onPick={() => setBillWith("credit")}
              />
            </div>
            {place.card_ok && billWith === "credit" ? (
              <p className="text-muted-foreground mt-3 px-1 text-sm">Your credit pays first and the card pays the rest.</p>
            ) : null}
          </>
        ) : null}

        {at === "tipWith" && tipCents > 0 ? (
          <div className="border-border mt-4 overflow-hidden rounded-2xl border" role="radiogroup" aria-label="Pay the tip with">
            <MethodRow name="pay-tip-with" icon={CreditCard} title="Card" note="The same card as the bill" checked disabled={false} onPick={() => {}} />
            <div className="bg-border h-px" />
            <MethodRow name="pay-tip-with" icon={WalletIcon} title="Credit" note="Tips go by card" checked={false} disabled onPick={() => {}} />
          </div>
        ) : null}

        {last && split && (split.kind === "credit" || split.kind === "card") ? (
          <div className="bg-muted/60 mt-4 flex flex-col gap-2 rounded-2xl px-4 py-3.5 text-sm tabular-nums" data-pay-split>
            {split.credit_cents > 0 ? (
              <p className="flex justify-between"><span>Bill · credit</span><span>{m(split.credit_cents)}</span></p>
            ) : null}
            {split.card_cents > 0 ? (
              <p className="flex justify-between"><span>Bill · card</span><span>{m(split.card_cents)}</span></p>
            ) : null}
            {split.tip_cents > 0 ? (
              <p className="flex justify-between"><span>Tip · card</span><span>{m(split.tip_cents)}</span></p>
            ) : null}
            {card?.raised ? (
              <p className="text-muted-foreground">Card minimum {m(place.card_min_cents)}: a little less credit is used</p>
            ) : null}
            <div className="bg-border h-px" />
            <p className="flex justify-between text-base font-semibold"><span>Total</span><span>{m(total)}</span></p>
            {earn > 0 ? (
              <p className="text-muted-foreground flex justify-between"><span>You get back as credit here</span><span>{m(earn)}</span></p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-border border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {last ? (
          <Button size="lg" className="w-full text-base font-semibold" disabled={!canPay} onClick={() => void pay()}>
            {busy ? <Spinner size="sm" label="Paying" /> : payLabel}
          </Button>
        ) : (
          <Button size="lg" className="w-full text-base font-semibold" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Next
          </Button>
        )}
        {reason && !busy ? <p className="text-muted-foreground mt-2 text-center text-xs">{reason}</p> : null}
        {last && card ? <p className="text-muted-foreground mt-2 text-center text-xs">You pay on Stripe&apos;s secure page</p> : null}
        {resume ? (
          <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} onClick={() => window.location.assign(resume)}>
            Resume card payment
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── The proof ────────────────────────────────────────────────────────────────

function ProofView({
  proof,
  onChange,
  onDone,
}: {
  proof: PayProof;
  onChange: (p: PayProof) => void;
  onDone: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const refunded = proof.status === "refunded";
  const partly = proof.status === "partly_refunded";
  // The card part's Checkout is still open (MESITA-3305): no proof yet.
  const open = proof.status === "open" || proof.status === "opening";
  // Closed with no money: Stripe expired it, or refused it.
  const closed = proof.status === "expired" || proof.status === "failed";
  const review = proof.status === "needs_review";
  const seen = proof.proof_seen_at;
  // A 403/404 on a read: not this guest's payment; polling stops.
  const [gone, setGone] = useState(false);
  // Two failed reads in a row grey the Paid line with "Reconnecting".
  const [failures, setFailures] = useState(0);
  const reconnecting = failures >= 2;
  const watch = !gone && ((!seen && !refunded && !closed && !review) || open);
  // A paid return reads "Confirming…" for 30 s, then "Still confirming".
  const [slow, setSlow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const m = (cents: number) => money(cents, proof.currency);
  const tip = proof.tip_cents ?? 0;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setSlow(true), CONFIRM_PATIENCE_MS);
    return () => clearTimeout(t);
  }, [open, proof.payment_id]);

  function refresh() {
    setRefreshing(true);
    void apiGetPayment(getSupabase(), proof.payment_id)
      .then(onChange)
      .catch((e) => (isGone(e) ? setGone(true) : toast(NETWORK_FAILURE, { tone: "error" })))
      .finally(() => setRefreshing(false));
  }

  // Leaving an unconfirmed payment reads it once more: a payment that went
  // through in the meantime shows its proof, never the form.
  function leave() {
    if (!open) {
      onDone();
      return;
    }
    void apiGetPayment(getSupabase(), proof.payment_id)
      .then((p) => (isOpen(p) || p.status === "expired" || p.status === "failed" ? onDone() : onChange(p)))
      .catch(() => onDone());
  }

  // Re-read every 5 s while visible, so the screen turns to Seen when the
  // waiter taps. Stops on Seen, while hidden, after 15 minutes, or on a
  // 403/404; one read when the page becomes visible again.
  useEffect(() => {
    if (!watch) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const read = () =>
      apiGetPayment(getSupabase(), proof.payment_id)
        .then((p) => {
          if (cancelled) return;
          setFailures(0);
          onChange(p);
        })
        .catch((e) => {
          if (cancelled) return;
          if (isGone(e)) {
            if (timer) clearTimeout(timer);
            setGone(true);
            return;
          }
          // A failed read keeps the QR and tries next tick.
          setFailures((n) => n + 1);
        });
    const tick = () => {
      if (cancelled || Date.now() - started > POLL_STOP_AFTER_MS || document.hidden) return;
      void read().then(() => {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      });
    };
    timer = setTimeout(tick, POLL_MS);
    const onVisible = () => {
      if (document.hidden) {
        if (timer) clearTimeout(timer);
        timer = undefined;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = undefined;
      // One read on coming back; inside the 15 minutes polling resumes.
      void read().then(() => {
        if (!cancelled && Date.now() - started <= POLL_STOP_AFTER_MS) timer = setTimeout(tick, POLL_MS);
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proof.payment_id, watch]);

  if (gone) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="border-border bg-card flex w-full flex-col items-center rounded-2xl border px-6 py-6">
          <p className="text-sm font-semibold" role="status">This payment isn&apos;t on your account</p>
        </div>
        <Button size="lg" className="mt-6 w-full text-base font-semibold" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  const paid = !open && !closed && !!proof.paid_at;
  const refundLine = refunded
    ? "Refunded"
    : partly
      ? proof.refunded_cents
        ? `Refunded ${m(proof.refunded_cents)}`
        : "Partly refunded"
      : null;

  return (
    <div className="flex flex-col items-center text-center">
      {proof.test_mode ? <TestBand className="mb-3 w-full text-left" /> : null}
      <div className="border-border bg-card flex w-full flex-col items-center rounded-2xl border px-6 py-6">
        {open ? (
          slow ? (
            <>
              <p className="text-sm font-semibold" role="status">Still confirming</p>
              <p className="text-muted-foreground mt-1 text-sm">We&apos;ll show the proof as soon as Stripe answers.</p>
            </>
          ) : (
            <p className="text-sm font-semibold" role="status">Confirming…</p>
          )
        ) : closed ? (
          <p className="text-sm font-semibold" role="status">Payment didn&apos;t go through</p>
        ) : review ? (
          <p className="text-sm font-semibold" role="status">We&apos;re checking this payment.</p>
        ) : !refunded && !seen ? (
          <p className="text-muted-foreground text-sm font-semibold">Show this to the staff</p>
        ) : null}
        <p className="font-display mt-3 text-4xl font-semibold tabular-nums" data-proof-total>
          {m(proof.amount_cents + tip)}
        </p>
        {tip > 0 ? (
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">
            {m(proof.amount_cents)} + {m(tip)} tip
          </p>
        ) : null}
        {proof.card_cents && proof.credit_cents ? (
          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
            {m(proof.credit_cents)} from credit · {m(proof.card_cents)} by card
          </p>
        ) : null}
        {refundLine ? <p className="text-muted-foreground mt-1 text-sm font-semibold">{refundLine}</p> : null}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-base font-semibold">
          <span className="min-w-0 truncate">{proof.place_name ?? "A Mesita place"}</span>
          {proof.place_marks ? <PlaceMarks tier={proof.place_marks.tier} mesitaPay={proof.place_marks.mesita_pay} ad={false} /> : null}
        </p>
        {paid ? (
          <p
            className={cn("mt-0.5 flex items-center gap-1.5 text-sm", reconnecting ? "text-muted-foreground opacity-60" : "text-foreground")}
            aria-live="polite"
            data-proof-status
          >
            {seen ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : null}
            {seen ? `Seen · ${clockTime(seen)}` : `Paid · ${clockTime(proof.paid_at as string)}`}
            {reconnecting && !seen ? <span> · Reconnecting</span> : null}
          </p>
        ) : null}
        {paid && !refunded ? <LiveClock /> : null}
        {proof.ticket ? <p className="text-muted-foreground mt-1 text-sm">Ticket {proof.ticket}</p> : null}
        {!refunded && proof.proof ? (
          <div className={cn("mt-4 rounded-xl bg-white p-3 transition", seen && "opacity-40")}>
            <QRCodeSVG value={proof.proof.url} size={208} marginSize={0} aria-label="Payment proof" />
          </div>
        ) : null}
      </div>
      {open ? (
        <>
          {proof.url ? (
            <Button size="lg" className="mt-6 w-full text-base font-semibold" onClick={() => window.location.assign(proof.url as string)}>
              Resume card payment
            </Button>
          ) : null}
          {slow ? (
            <button
              type="button"
              className={cn(QUIET_BUTTON_CLASS, proof.url ? "mt-3" : "mt-6")}
              disabled={refreshing}
              onClick={refresh}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          ) : null}
          <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} onClick={leave}>
            Done
          </button>
        </>
      ) : (
        <Button size="lg" className="mt-6 w-full text-base font-semibold" onClick={onDone}>
          Done
        </Button>
      )}
    </div>
  );
}

function ProofSkeleton() {
  return (
    <div className="border-border bg-card flex flex-col items-center rounded-2xl border px-6 py-6" aria-busy>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-[232px] w-[232px] rounded-xl" />
      <Skeleton className="mt-5 h-9 w-32" />
      <Skeleton className="mt-3 h-4 w-28" />
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
