"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, QrCode, Wallet as WalletIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TestBand } from "@mesita/place-profile";
import { amountText, clockTime, readAmount } from "@mesita/place-profile/lib/money";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import {
  apiGetPayment,
  apiGetWallet,
  apiStartPayment,
  attemptFor,
  money,
  PAY_REFUSAL,
  type PayAttempt,
  type PayProof,
  splitPayment,
  type Wallet,
  type WalletBalance,
} from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// THE PAY TAB PAYS A PLACE FROM THE GUEST'S CREDIT THERE (MESITA-3304, W2a).
// Four states on one page: Empty (no credit anywhere), Pending only (a
// voucher's hour is still running), the form (places with credit, an
// amount, an optional ticket number) and Paid (the proof QR staff scan on
// visit.mesita.ai). Every amount shown is a server field; the server is the
// last word on whether the money is there.
//
// The paid state is the address: `/pay?payment=<id>` (set with
// replaceState, kept in local state as the Wallet does with ?prepay=), so a
// reload or a Wallet "Paid" row shows the same proof. While the proof is
// unseen the page asks the server every 5 s (15 s after two minutes, never
// while the tab is hidden, and only on focus after 30 minutes), so it
// changes to "Seen" when the waiter taps.
//
// The card part (MESITA-3305, W2b): where the place takes cards (the
// server's `card_ok`), an amount past the credit splits, "MX$X from credit ·
// MX$Y by card", with an optional tip by card, and the button opens Stripe
// Checkout on the place's account. Checkout returns to `/pay?payment=<id>`,
// where the read settles the payment; while it is still open the page says
// so, offers to resume the Checkout, and asks again every 5 s.

const PAYMENT_PARAM = "payment";
const POLL_FAST_MS = 5_000;
const POLL_SLOW_MS = 15_000;
const POLL_SLOW_AFTER_MS = 2 * 60_000;
const POLL_STOP_AFTER_MS = 30 * 60_000;
const NETWORK_FAILURE = "Couldn't reach Mesita. Tap again.";

const FIELD_CLASS =
  "border-border bg-background text-foreground placeholder:text-muted-foreground h-12 w-full rounded-xl border px-3 text-base outline-none focus:border-foreground";
/** The quiet second button under the pink one: Resume a Checkout, Done
 *  while one is open. The same shape as "Pay all". */
const QUIET_BUTTON_CLASS =
  "border-border bg-card hover:bg-muted min-h-12 w-full rounded-2xl border px-4 text-base font-semibold transition";

const noSubscribe = () => () => {};

function setPaymentParam(id: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (id) params.set(PAYMENT_PARAM, id);
  else params.delete(PAYMENT_PARAM);
  const q = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
}

const keyOf = (b: WalletBalance) => `${b.place_id}:${b.currency}`;

export function PayPage() {
  const getSupabase = useLazyBrowserSupabase();
  // Read once on the client so a load with ?payment= draws the proof's
  // skeleton, never the form; the server render reads "".
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  const askedPayment = new URLSearchParams(search).get(PAYMENT_PARAM);

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletFailed, setWalletFailed] = useState(false);
  const [walletNonce, setWalletNonce] = useState(0);
  const [proof, setProof] = useState<PayProof | null>(null);
  const [proofDone, setProofDone] = useState(false);

  // Boot: a ?payment= load reads that payment; otherwise (and after Done)
  // the Wallet answers what can pay.
  useEffect(() => {
    let cancelled = false;
    const id = new URLSearchParams(window.location.search).get(PAYMENT_PARAM);
    if (id && !proofDone) {
      void apiGetPayment(getSupabase(), id)
        .then((p) => {
          if (!cancelled) setProof(p);
        })
        .catch((e) => {
          if (cancelled) return;
          if (e instanceof EFError && e.code) {
            setPaymentParam(null);
            toast("That payment isn't here.", { tone: "error" });
            setProofDone(true);
          } else {
            setWalletFailed(true);
          }
        });
      return () => {
        cancelled = true;
      };
    }
    void apiGetWallet(getSupabase())
      .then((w) => {
        if (cancelled) return;
        setWallet(w);
        setWalletFailed(false);
      })
      .catch(() => {
        if (!cancelled) setWalletFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletNonce, proofDone]);

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
    setPaymentParam(null);
    setProof(null);
    setProofDone(true);
    setWallet(null);
    setWalletNonce((n) => n + 1);
  }

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Pay</h1>
      <p className="text-muted-foreground type-body mt-1">Pay a bill with your credit at a place.</p>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        {proof ? (
          <ProofView proof={proof} onChange={setProof} onDone={done} />
        ) : askedPayment && !proofDone && !walletFailed ? (
          <ProofSkeleton />
        ) : wallet ? (
          <PayForm wallet={wallet} onPaid={showProof} onTaken={openPayment} onRefresh={() => setWalletNonce((n) => n + 1)} />
        ) : walletFailed ? (
          <EmptyState
            icon={WalletIcon}
            title="Couldn't load Pay"
            description="Check your connection and try again."
            action={{ label: "Try again", onClick: () => setWalletNonce((n) => n + 1) }}
          />
        ) : (
          <FormSkeleton />
        )}
      </div>
    </div>
  );
}

// ── The form ─────────────────────────────────────────────────────────────────

function PayForm({
  wallet,
  onPaid,
  onTaken,
  onRefresh,
}: {
  wallet: Wallet;
  onPaid: (p: PayProof) => void;
  onTaken: (paymentId: string) => void;
  onRefresh: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  // A place pays when the guest holds credit there, or when it takes cards
  // (a card-only payment where the credit ran out, MESITA-3305).
  const payable = wallet.balances.filter((b) => b.available_cents > 0 || b.card_ok === true);
  const [picked, setPicked] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState("");
  const [ticket, setTicket] = useState("");
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState<string | null>(null);
  const attempt = useRef<PayAttempt | null>(null);

  if (payable.length === 0) {
    const pending = wallet.balances.filter((b) => b.pending_cents > 0);
    if (pending.length > 0) {
      return (
        <div className="border-border bg-card rounded-2xl border px-4 py-4">
          {wallet.test_mode ? <TestBand className="mb-3" /> : null}
          {pending.map((b) => (
            <p key={keyOf(b)} className="text-sm">
              <span className="font-semibold">{b.place?.name ?? "A Mesita place"}</span>
              <span className="text-muted-foreground">
                {" "}· {money(b.pending_cents, b.currency)} pending · available within the hour
              </span>
            </p>
          ))}
          <p className="text-muted-foreground mt-2 text-sm">You can pay here as soon as it&apos;s available.</p>
        </div>
      );
    }
    return (
      <EmptyState
        icon={QrCode}
        title="Nothing to pay with yet"
        description="Buy a voucher at a place and pay here from your credit."
        action={{ label: "Find a place", href: CONSUMER_ROUTES.search }}
      />
    );
  }

  // The lit row: the one picked, else the place with the newest activity
  // (balances arrive newest first).
  const place = payable.find((b) => keyOf(b) === picked) ?? payable[0];
  const cents = readAmount(amount);
  const split = cents === null ? null : splitPayment(cents, place.spendable_cents, place.card_ok === true);
  const over = split?.kind === "over";
  const byCard = split !== null && (split.kind === "mixed" || split.kind === "card");
  const tipCents = byCard ? (readAmount(tip) ?? 0) : 0;
  const canPay = cents !== null && !over && !busy;

  function pick(b: WalletBalance) {
    if (keyOf(b) === keyOf(place)) return;
    setPicked(keyOf(b));
    setAmount("");
    setTip("");
    setTicket("");
    setResume(null);
  }

  async function pay() {
    if (cents === null || !split || over || busy) return;
    const a = attemptFor(attempt.current, place.place_id, cents + (byCard ? tipCents : 0));
    attempt.current = a;
    setBusy(true);
    setResume(null);
    try {
      const started = await apiStartPayment(getSupabase(), {
        place_id: place.place_id,
        place_name: place.place?.name ?? null,
        amount_cents: cents,
        ...(byCard ? { card_cents: split.card_cents, tip_cents: tipCents, return_url: `${window.location.origin}${CONSUMER_ROUTES.pay}` } : {}),
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
      if (e.code === "insufficient" && typeof body.spendable_cents === "number") {
        toast(`You have ${money(body.spendable_cents, place.currency)} of credit here.`, { tone: "error" });
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

  const payLabel = cents === null
    ? "Pay"
    : split?.kind === "credit"
    ? `Pay ${money(cents, place.currency)} from credit`
    : `Pay ${money(cents + tipCents, place.currency)} · continue to card`;

  return (
    <div className="flex flex-col">
      {wallet.test_mode ? <TestBand className="mb-3" /> : null}
      <div className="border-border bg-card overflow-hidden rounded-2xl border" role="radiogroup" aria-label="Place">
        {payable.map((b, i) => {
          const lit = keyOf(b) === keyOf(place);
          return (
            <Fragment key={keyOf(b)}>
              {i > 0 && <RowDivider />}
              <button
                type="button"
                role="radio"
                aria-checked={lit}
                onClick={() => pick(b)}
                className={cn("flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition", lit ? "bg-muted" : "hover:bg-muted/60")}
              >
                <span
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-full border-2",
                    lit ? "border-foreground bg-foreground" : "border-border",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{b.place?.name ?? "A Mesita place"}</span>
                <span className="font-display shrink-0 text-base font-semibold tabular-nums">
                  {money(b.spendable_cents, b.currency)}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
      <p className="text-muted-foreground mt-2 text-sm">
        You have {money(place.spendable_cents, place.currency)} here
        {place.card_ok ? <span> · cards accepted</span> : null}
      </p>

      <label className="mt-5 block text-sm font-semibold" htmlFor="pay-amount">
        Amount
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id="pay-amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={cn(FIELD_CLASS, "tabular-nums")}
        />
        <button
          type="button"
          onClick={() => setAmount(amountText(place.spendable_cents))}
          disabled={place.spendable_cents <= 0}
          className="border-border bg-card hover:bg-muted h-12 shrink-0 rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-50"
        >
          Pay all
        </button>
      </div>
      {over ? <p className="text-muted-foreground mt-1.5 text-xs">More than you have here</p> : null}
      {byCard && split ? (
        <p className="text-muted-foreground mt-1.5 text-xs" data-pay-split>
          {split.credit_cents > 0 ? `${money(split.credit_cents, place.currency)} from credit · ` : ""}
          {money(split.card_cents, place.currency)} by card
        </p>
      ) : null}

      {byCard ? (
        <>
          <label className="mt-4 block text-sm font-semibold" htmlFor="pay-tip">
            Tip <span className="text-muted-foreground font-normal">(optional, by card)</span>
          </label>
          <input
            id="pay-tip"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            className={cn(FIELD_CLASS, "mt-1.5 tabular-nums")}
          />
        </>
      ) : null}

      <label className="mt-4 block text-sm font-semibold" htmlFor="pay-ticket">
        Ticket number <span className="text-muted-foreground font-normal">(optional)</span>
      </label>
      <input
        id="pay-ticket"
        autoComplete="off"
        maxLength={32}
        value={ticket}
        onChange={(e) => setTicket(e.target.value)}
        className={cn(FIELD_CLASS, "mt-1.5")}
      />

      <Button size="lg" className="mt-6 w-full text-base font-semibold" disabled={!canPay} onClick={() => void pay()}>
        {busy ? "Paying…" : payLabel}
      </Button>
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
          <p className="text-sm font-semibold" role="status">Confirming your card payment…</p>
        ) : closed ? (
          <p className="text-sm font-semibold" role="status">Checkout cancelled. Nothing was charged.</p>
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
      {open && proof.url ? (
        <>
          <Button size="lg" className="mt-6 w-full text-base font-semibold" onClick={() => window.location.assign(proof.url as string)}>
            Resume card payment
          </Button>
          <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} onClick={onDone}>
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

function FormSkeleton() {
  return (
    <div aria-busy>
      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        {[0, 1].map((i) => (
          <Fragment key={i}>
            {i > 0 && <RowDivider />}
            <div className="flex min-h-14 items-center gap-3 px-4 py-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-16" />
            </div>
          </Fragment>
        ))}
      </div>
      <Skeleton className="mt-5 h-12 w-full rounded-xl" />
      <Skeleton className="mt-6 h-12 w-full rounded-2xl" />
    </div>
  );
}
