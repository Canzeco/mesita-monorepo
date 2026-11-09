"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, MapPin, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cashbackFor, paySplit, PlaceMarks, TestBand, type PaySplit } from "@mesita/place-profile";
import { amountText, clockTime, readAmount } from "@mesita/place-profile/lib/money";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import {
  apiGetPayment,
  apiListPayPlaces,
  apiReleasePayment,
  apiStartPayment,
  attemptFor,
  money,
  PAY_REFUSAL,
  type PayAttempt,
  type PayPlace,
  type PayProof,
} from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot, requestUserLocation } from "@/lib/use-user-location";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// THE PAY TAB (MESITA-3304 credit, MESITA-3305 the card part, MESITA-3457
// the list and one amount). Three screens on one page: the list of places
// the guest can pay at now (consumer-web-list-pay-places: their credit
// first, then Mesita Pay places nearest first), the form for one place, and
// the proof. Every amount shown is a server field or the shared paySplit
// twin the server's own rule is tested against; the server is the last word.
//
// The form takes ONE amount, what the guest pays on Mesita: available credit
// covers it first, the rest goes by card where Mesita Pay is on, shown live
// as the split (the split is the review). A tip is its own amount, by card
// only, with no fee and no cashback. Where card + tip is under the card
// minimum, less credit is used so the card part reaches it.
//
// The location is asked once, after a priming card ("See Mesita Pay places
// near you"), rounded to 3 decimals and sent only to the list read. The
// table QR opens `/pay?place=<id>`: the shell's sign-in wall carries it
// through sign-in, and the form opens for that place, or the list says the
// place isn't taking Mesita Pay.
//
// The paid state is the address: `/pay?payment=<id>` (set with
// replaceState), so a reload or a Wallet "Paid" row shows the same proof.
// While the proof is unseen the page asks the server every 5 s (15 s after
// two minutes, never while the tab is hidden, and only on focus after 30
// minutes), so it changes to "Seen" when the waiter taps.
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
/** How long a paid return reads "Confirming…" before "Still confirming". */
const CONFIRM_PATIENCE_MS = 30_000;
const POLL_FAST_MS = 5_000;
const POLL_SLOW_MS = 15_000;
const POLL_SLOW_AFTER_MS = 2 * 60_000;
const POLL_STOP_AFTER_MS = 30 * 60_000;
const NETWORK_FAILURE = "Couldn't reach Mesita. Tap again.";
/** The location the list read carries, in decimals (~110 m). The server's
 *  twin is LOCATION_DECIMALS in _shared/pay-places.ts. */
const LOCATION_DECIMALS = 3;
/** "Not now" on the location card holds for this browser session. */
const LOCATION_NOT_NOW_KEY = "mesita.pay.location-not-now";
const NOT_TAKING = "This place isn't taking Mesita Pay right now";

const FIELD_CLASS =
  "border-border bg-background text-foreground placeholder:text-muted-foreground h-12 w-full rounded-xl border px-3 text-base outline-none focus:border-foreground";
/** The quiet second button under the pink one: Resume a Checkout, Done
 *  while one is open. */
const QUIET_BUTTON_CLASS =
  "border-border bg-card hover:bg-muted min-h-12 w-full rounded-2xl border px-4 text-base font-semibold transition";

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

  const [places, setPlaces] = useState<PayPlace[] | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [listNonce, setListNonce] = useState(0);
  const [proof, setProof] = useState<PayProof | null>(null);
  const [proofDone, setProofDone] = useState(false);
  const [refill, setRefill] = useState<Refill | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loc, setLoc] = useState<Loc>({ state: "unknown" });
  const askedPlace = useRef<string | null | undefined>(undefined);

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
        if (e instanceof EFError && e.code) toast("That payment isn't here.", { tone: "error" });
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
            if (hit && (hit.card_ok || hit.available_cents > 0)) setOpenId(hit.place_id);
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

  const open = openId && places ? places.find((p) => p.place_id === openId) ?? null : null;

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Pay</h1>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        {proof ? (
          <ProofView proof={proof} onChange={setProof} onDone={done} />
        ) : askedPayment && !proofDone ? (
          <ProofSkeleton />
        ) : open ? (
          <PayForm
            key={open.place_id}
            place={open}
            refill={refill && refill.placeId === open.place_id ? refill : null}
            onBack={() => {
              setOpenId(null);
              setRefill(null);
            }}
            onPaid={showProof}
            onTaken={openPayment}
            onRefresh={refresh}
          />
        ) : places ? (
          <PlaceList
            places={places}
            loc={loc}
            notice={notice}
            onPick={(id) => {
              setNotice(null);
              setOpenId(id);
            }}
            onOpenPayment={openPayment}
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
    </div>
  );
}

// ── The list ─────────────────────────────────────────────────────────────────

function PlaceList({
  places,
  loc,
  notice,
  onPick,
  onOpenPayment,
  onUseLocation,
  onNotNow,
}: {
  places: PayPlace[];
  loc: Loc;
  notice: string | null;
  onPick: (placeId: string) => void;
  onOpenPayment: (paymentId: string) => void;
  onUseLocation: () => void;
  onNotNow: () => void;
}) {
  const testMode = places.some((p) => p.test_mode);
  return (
    <div className="flex flex-col">
      {testMode ? <TestBand className="mb-3" /> : null}
      {notice ? (
        <p className="border-border bg-card mb-3 rounded-2xl border px-4 py-3 text-sm font-semibold" role="status">
          {notice}
        </p>
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
          action={{ label: "Find a place", href: CONSUMER_ROUTES.search }}
        />
      ) : (
        <>
          <div className="border-border bg-card overflow-hidden rounded-2xl border">
            {places.map((p, i) => {
              // The server lists a payment only within PAID_RECENT_HOURS of paying.
              const recent = p.paid_recent;
              return (
                <Fragment key={p.place_id}>
                  {i > 0 && <RowDivider />}
                  <div>
                    <button
                      type="button"
                      onClick={() => onPick(p.place_id)}
                      className="hover:bg-muted/60 flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1">
                          <span className="truncate text-sm font-semibold">{p.name ?? "A Mesita place"}</span>
                          <PlaceMarks tier={p.marks.tier} mesitaPay={p.marks.mesita_pay} compact ad={false} />
                        </span>
                        <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
                          {p.distance_m !== null ? <span>{distanceText(p.distance_m)}</span> : null}
                          {p.available_cents <= 0 && p.pending_cents > 0 ? (
                            <span>{money(p.pending_cents, p.currency)} pending · available within the hour</span>
                          ) : null}
                          {!p.card_ok ? <span>Credit only</span> : null}
                          {p.test_mode ? (
                            <span className="border-border rounded-md border px-1.5 type-label font-semibold uppercase">Test</span>
                          ) : null}
                        </span>
                      </span>
                      {p.available_cents > 0 ? (
                        <span className="font-display shrink-0 text-base font-semibold tabular-nums">
                          {money(p.available_cents, p.currency)}
                        </span>
                      ) : null}
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                    </button>
                    {recent ? (
                      <button
                        type="button"
                        onClick={() => onOpenPayment(recent.payment_id)}
                        className="text-muted-foreground hover:text-foreground flex min-h-11 w-full items-center gap-1.5 px-4 pb-3 text-left text-xs font-semibold"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        Paid {money(recent.total_cents, p.currency)} · {clockTime(recent.paid_at)}
                      </button>
                    ) : null}
                  </div>
                </Fragment>
              );
            })}
          </div>
          <a
            href={CONSUMER_ROUTES.search}
            className="border-border bg-card hover:bg-muted mt-4 flex min-h-12 items-center justify-center rounded-2xl border px-4 text-base font-semibold transition"
          >
            Find a place
          </a>
        </>
      )}
    </div>
  );
}

// ── The form ─────────────────────────────────────────────────────────────────

function splitLine(s: PaySplit, currency: string, minCents: number): string | null {
  if (s.kind === "credit") return `${money(s.credit_cents, currency)} from credit`;
  if (s.kind !== "card") return null;
  const parts: string[] = [];
  if (s.credit_cents > 0) parts.push(`${money(s.credit_cents, currency)} from credit`);
  if (s.card_cents > 0) parts.push(`${money(s.card_cents, currency)} by card`);
  if (s.tip_cents > 0) parts.push(`${money(s.tip_cents, currency)} tip by card`);
  return `${parts.join(" · ")}${s.raised ? ` (card minimum ${money(minCents, currency)})` : ""}`;
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
  const [amount, setAmount] = useState(() => (refill ? amountText(refill.amountCents) : ""));
  const [tip, setTip] = useState(() => (refill && refill.tipCents > 0 ? amountText(refill.tipCents) : ""));
  const [ticket, setTicket] = useState(() => refill?.ticket ?? "");
  const [cancelNote, setCancelNote] = useState(refill !== null);
  const [creditChanged, setCreditChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState<string | null>(null);
  const attempt = useRef<PayAttempt | null>(null);

  const cents = readAmount(amount);
  const tipTyped = place.card_ok ? readAmount(tip) : null;
  const tipBad = place.card_ok && tip.trim() !== "" && tipTyped === null;
  const split = cents === null
    ? null
    : paySplit({
      amountCents: cents,
      tipCents: tipTyped ?? 0,
      availableCents: place.available_cents,
      cardOk: place.card_ok,
      minCents: place.card_min_cents,
    });
  const card = split?.kind === "card" ? split : null;
  const total = card ? card.credit_cents + card.card_cents + card.tip_cents : (cents ?? 0);
  const earn = card ? cashbackFor(card.card_cents, place.cashback_bps) : 0;

  const reason = amount.trim() !== "" && cents === null
    ? "Type an amount like 250 or 250.50"
    : split?.kind === "over"
    ? `More than your ${money(place.available_cents, place.currency)} of credit here`
    : split?.kind === "below_minimum"
    ? `Card payments start at ${money(split.minimum_cents, place.currency)}`
    : tipBad
    ? "Type a tip like 30 or 30.50"
    : null;
  const canPay = split !== null && (split.kind === "credit" || split.kind === "card") && !tipBad && !busy;

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
        amount_cents: cents,
        ...(card ? { card_cents: card.card_cents, tip_cents: card.tip_cents, return_url: `${window.location.origin}${CONSUMER_ROUTES.pay}` } : {}),
        request_id: a.requestId,
        ticket: ticket.trim() || null,
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
      if (e.code === "taken" && typeof body.payment_id === "string") {
        onTaken(body.payment_id);
        return;
      }
      if (e.code === "insufficient" || e.code === "below_minimum") {
        // The credit moved under the form: re-read, show the new split.
        setCreditChanged(true);
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

  const line = split ? splitLine(split, place.currency, place.card_min_cents) : null;
  const payLabel = !split || cents === null
    ? "Pay"
    : card
    ? `Pay ${money(total, place.currency)}`
    : `Pay ${money(cents, place.currency)} with credit`;

  return (
    <div className="flex flex-col">
      {place.test_mode ? <TestBand className="mb-3" /> : null}
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground -ml-1 flex min-h-11 items-center gap-1 self-start text-sm font-semibold"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        All places
      </button>
      <p className="mt-1 flex min-w-0 items-center gap-1">
        <span className="truncate text-lg font-semibold">{place.name ?? "A Mesita place"}</span>
        <PlaceMarks tier={place.marks.tier} mesitaPay={place.marks.mesita_pay} compact ad={false} />
      </p>
      <p className="text-muted-foreground mt-0.5 text-sm">
        {money(place.available_cents, place.currency)} available credit
        {place.pending_cents > 0 ? ` · ${money(place.pending_cents, place.currency)} pending` : ""}
        {place.card_ok ? "" : " · Credit only"}
      </p>
      {cancelNote ? (
        <p className="text-muted-foreground mt-3 text-sm" role="status">
          Payment cancelled
        </p>
      ) : null}

      <label className="mt-5 block text-sm font-semibold" htmlFor="pay-amount">
        Amount
      </label>
      <input
        id="pay-amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          setCreditChanged(false);
        }}
        className={cn(FIELD_CLASS, "mt-1.5 tabular-nums")}
      />
      {amount.trim() !== "" && cents === null ? (
        <p className="text-destructive mt-1.5 text-xs">Type an amount like 250 or 250.50</p>
      ) : split?.kind === "over" ? (
        <p className="text-destructive mt-1.5 text-xs">More than your {money(place.available_cents, place.currency)} of credit here</p>
      ) : null}

      {place.card_ok ? (
        <>
          <label className="mt-4 block text-sm font-semibold" htmlFor="pay-tip">
            Tip <span className="text-muted-foreground font-normal">(optional, by card)</span>
          </label>
          <input
            id="pay-tip"
            inputMode="decimal"
            autoComplete="off"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            className={cn(FIELD_CLASS, "mt-1.5 tabular-nums")}
          />
          {tipBad ? <p className="text-destructive mt-1.5 text-xs">Type a tip like 30 or 30.50</p> : null}
        </>
      ) : null}

      <label className="mt-4 block text-sm font-semibold" htmlFor="pay-ticket">
        Ticket or table no. <span className="text-muted-foreground font-normal">(optional)</span>
      </label>
      <input
        id="pay-ticket"
        autoComplete="off"
        maxLength={32}
        value={ticket}
        onChange={(e) => setTicket(e.target.value)}
        className={cn(FIELD_CLASS, "mt-1.5")}
      />

      {creditChanged ? (
        <p className="mt-5 text-sm font-semibold" role="status">
          Your credit changed
        </p>
      ) : null}
      {line ? (
        <div className={cn("border-border bg-card rounded-2xl border px-4 py-3", creditChanged ? "mt-2" : "mt-5")} data-pay-split>
          <p className="text-sm font-semibold">{line}</p>
          {earn > 0 ? (
            <p className="text-muted-foreground mt-0.5 text-sm">You earn {money(earn, place.currency)} back · available in an hour</p>
          ) : null}
        </div>
      ) : null}

      <Button size="lg" className="mt-5 w-full text-base font-semibold" disabled={!canPay} onClick={() => void pay()}>
        {busy ? <Spinner size="sm" label="Paying" /> : payLabel}
      </Button>
      {reason && !busy ? <p className="text-muted-foreground mt-2 text-center text-xs">{reason}</p> : null}
      {resume ? (
        <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} onClick={() => window.location.assign(resume)}>
          Resume card payment
        </button>
      ) : null}
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
  const watch = (!seen && !refunded && !closed && !review) || open;
  // A paid return reads "Confirming…" for 30 s, then "Still confirming".
  const [slow, setSlow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setSlow(true), CONFIRM_PATIENCE_MS);
    return () => clearTimeout(t);
  }, [open, proof.payment_id]);

  function refresh() {
    setRefreshing(true);
    void apiGetPayment(getSupabase(), proof.payment_id)
      .then(onChange)
      .catch(() => toast(NETWORK_FAILURE, { tone: "error" }))
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

  // Re-read while unseen, so the screen turns to Seen when the waiter taps.
  useEffect(() => {
    if (!watch) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const read = () =>
      apiGetPayment(getSupabase(), proof.payment_id)
        .then((p) => {
          if (!cancelled) onChange(p);
        })
        // A failed read keeps the QR and tries next tick.
        .catch(() => {});
    const tick = () => {
      const elapsed = Date.now() - started;
      if (elapsed > POLL_STOP_AFTER_MS) return;
      if (!document.hidden) void read();
      timer = setTimeout(tick, elapsed > POLL_SLOW_AFTER_MS ? POLL_SLOW_MS : POLL_FAST_MS);
    };
    timer = setTimeout(tick, POLL_FAST_MS);
    const onFocus = () => {
      if (Date.now() - started > POLL_STOP_AFTER_MS) void read();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proof.payment_id, watch]);

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
        ) : refunded ? null : seen ? (
          <p className="text-foreground flex items-center gap-1.5 text-sm font-semibold" role="status">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Seen · {clockTime(seen)}
          </p>
        ) : (
          <p className="text-sm font-semibold">Show this to the staff</p>
        )}
        {!refunded && proof.proof ? (
          <div className={cn("mt-4 rounded-xl bg-white p-3 transition", seen && "opacity-40")}>
            <QRCodeSVG value={proof.proof.url} size={208} marginSize={0} aria-label="Payment proof" />
          </div>
        ) : null}
        <p className="font-display mt-5 text-4xl font-semibold tabular-nums">{money(proof.amount_cents, proof.currency)}</p>
        {proof.card_cents ? (
          <p className="text-muted-foreground mt-1 text-xs">
            {proof.credit_cents ? `${money(proof.credit_cents, proof.currency)} from credit · ` : ""}
            {money(proof.card_cents, proof.currency)} by card
            {proof.tip_cents ? ` · ${money(proof.tip_cents, proof.currency)} tip` : ""}
          </p>
        ) : null}
        {refunded || partly ? (
          <p className="text-muted-foreground mt-1 text-sm font-semibold">{refunded ? "Refunded" : "Partly refunded"}</p>
        ) : null}
        <p className="mt-2 text-sm font-semibold">{proof.place_name ?? "A Mesita place"}</p>
        {proof.paid_at ? <p className="text-muted-foreground mt-0.5 text-sm">Paid · {clockTime(proof.paid_at)}</p> : null}
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
      <Skeleton className="mt-4 h-12 w-full rounded-2xl" />
    </div>
  );
}
