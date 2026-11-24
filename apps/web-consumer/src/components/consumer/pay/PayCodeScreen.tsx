"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { BadgePercent, Banknote, HandCoins, Loader2, ReceiptText, Wallet, XCircle } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiAnswerBill, apiGetPayCode, billNeedsGuest, type GuestBill, type PayCode } from "@/lib/api/pay-bill";
import { money, payPlaceCashbackBps, payPlaceDiscountBps } from "@/lib/api/wallet";
import { payBillPath } from "@/lib/consumer-route-contract";
import { goBack, navigateTo } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useWakeLock } from "@/lib/use-wake-lock";
import { cn } from "@/lib/utils";
import { BAD, BOX_TINT, MoneyRow, PaySection, StepBody, StepStrip, TicketHeader } from "./pay-flow";
import { CancelBillButtons, NETWORK_FAILURE, PlacePhoto, QUIET_BUTTON_CLASS } from "./pay-common";
import { usePayPlaces } from "./use-pay-places";

// THE WAITER LEADS (Pato, 2026-11-24, MESITA-4823): /pay/code. The guest's one
// general Mesita QR, never a place's; the waiter scans it and sends the bill;
// this same screen becomes the bill:
//
//   QR         "Show this to your waiter"; no digits under it (MESITA-4826)
//   bill       what it comes to; Accept or Decline
//   accepted   Pay $X at the place; only the waiter confirms it
//   paid       the receipt (/pay/bill/<id>)
//   over       declined, cancelled or expired, and the QR again
//
// `from` (a place's Pay Bill) only says what the guest gets there; it is never
// sent: the waiter's phone names the place. Credits are used to the maximum
// and never pay the tip; the server works every number out, and Accept names
// the version on screen.

const FAST_MS = 3000;
const SLOW_MS = 5000;
/** A new QR this long before the old one ends. */
const RENEW_MS = 60_000;
/** A bill that just changed can't be accepted by a tap already on its way. */
const REARM_MS = 1000;
const CODE_KEY = "mesita.pay.code";

function keptCode(): PayCode | null {
  try {
    const c = JSON.parse(window.sessionStorage.getItem(CODE_KEY) ?? "null") as PayCode | null;
    return c && Date.parse(c.expires_at) > Date.now() ? c : null;
  } catch {
    return null;
  }
}

export function PayCodeScreen({ from }: { from: string | null }) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const { places } = usePayPlaces(null);
  const here = from ? (places?.find((p) => p.place_id === from) ?? null) : null;

  const [code, setCode] = useState<PayCode | null>(null);
  const [codeFailed, setCodeFailed] = useState(false);
  const [bill, setBill] = useState<GuestBill | null>(null);
  const [misses, setMisses] = useState(0);
  const [busy, setBusy] = useState<"accept" | "decline" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [armedAt, setArmedAt] = useState(0);
  const following = useRef<string | null>(null);
  const seen = useRef("");
  const changedAt = useRef(0);
  const alive = useRef(true);
  const reads = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const take = useCallback(
    (b: GuestBill | null) => {
      setMisses(0);
      setNow(Date.now());
      const shown = b;
      if (billNeedsGuest(shown)) following.current = shown.id;
      const key = shown ? `${shown.id}:${shown.state}:${shown.version}` : "";
      if (key !== seen.current) {
        seen.current = key;
        changedAt.current = Date.now();
        setArmedAt(Date.now() + REARM_MS);
      }
      if (shown?.state === "paid" && shown.attempt_id) {
        navigateTo(router, payBillPath(shown.attempt_id), { replace: true });
      }
      setBill(shown);
    },
    [router],
  );

  const refresh = useCallback(async () => {
    const n = ++reads.current;
    try {
      const r = await apiGetPayCode(getSupabase(), following.current ? { bill_id: following.current } : {});
      if (alive.current && n === reads.current) take(r.bill);
    } catch {
      if (alive.current) setMisses((x) => x + 1);
    }
  }, [getSupabase, take]);

  const mint = useCallback(async () => {
    try {
      const r = await apiGetPayCode(getSupabase(), { mint: true, ...(following.current ? { bill_id: following.current } : {}) });
      if (!alive.current) return;
      setCodeFailed(false);
      if (r.code) {
        setCode(r.code);
        try {
          window.sessionStorage.setItem(CODE_KEY, JSON.stringify(r.code));
        } catch {
          // Private mode: a reload mints another.
        }
      }
      take(r.bill);
    } catch {
      if (!alive.current) return;
      // No signal: the last QR still works until it ends.
      const kept = keptCode();
      if (kept) setCode(kept);
      else setCodeFailed(true);
    }
  }, [getSupabase, take]);

  const busyBill = billNeedsGuest(bill);
  const showing = !bill || bill.state === "open";

  useEffect(() => {
    const id = setTimeout(() => void mint(), 0);
    return () => clearTimeout(id);
  }, [mint]);

  // A new QR before this one ends, while it is the one on screen.
  useEffect(() => {
    if (!code || !showing) return;
    const wait = Math.max(Date.parse(code.expires_at) - Date.now() - RENEW_MS, 1000);
    const id = setTimeout(() => void mint(), wait);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.parse(code.expires_at) - Date.now() < RENEW_MS) void mint();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [code, showing, mint]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (document.visibilityState === "visible") await refresh();
      if (alive.current) timer = setTimeout(() => void loop(), Date.now() - changedAt.current < 120_000 ? FAST_MS : SLOW_MS);
    };
    timer = setTimeout(() => void loop(), FAST_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // The countdown, and Accept's one-second re-arm.
  useEffect(() => {
    if (!busyBill) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [busyBill]);
  useWakeLock(showing || busyBill);

  async function answer(action: "accept" | "decline" | "not_mine" | "cancel") {
    if (!bill || busy) return;
    setBusy(action === "not_mine" ? "decline" : action);
    setError(null);
    try {
      await apiAnswerBill(getSupabase(), {
        bill_id: bill.id,
        action,
        ...(action === "accept" || action === "decline" ? { version: bill.version } : {}),
      });
      if (action === "not_mine") {
        reads.current++;
        following.current = null;
        setBill(null);
        setCode(null);
        await mint();
      } else await refresh();
    } catch (e) {
      // A lost answer is safe to tap again: the bill is accepted once.
      setError(e instanceof EFError && e.status !== null && e.status < 500 ? e.message : NETWORK_FAILURE);
      await refresh();
    } finally {
      if (alive.current) {
        setBusy(null);
        setConfirmCancel(false);
      }
    }
  }

  function again() {
    // A declined bill the waiter sends again comes back by itself.
    reads.current++;
    following.current = null;
    setError(null);
    setBill(null);
    void mint();
  }

  const leave = () => goBack(router);
  const frame = (title: string, body: React.ReactNode, footer: React.ReactNode, step: number | "done") => (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col" data-pay-code={bill?.state ?? "qr"}>
      <TicketHeader title={title} onClose={leave} closeLabel="Close" />
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <StepBody className="min-h-0 flex-1">
          {misses >= 2 ? (
            <p className="text-muted-foreground text-sm" role="status">
              No connection. If it stays, pay normally: nothing was used.
            </p>
          ) : null}
          {body}
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </StepBody>
        <div className="border-border -mx-4 mt-3 flex shrink-0 flex-col gap-3 border-t px-4 pt-3">
          <StepStrip at={step} className="[@media(max-height:620px)]:hidden" />
          {footer}
        </div>
      </div>
    </div>
  );

  // THE QR.
  if (!bill || bill.state === "open") {
    const typing = bill?.state === "open";
    const discount = here ? payPlaceDiscountBps(here) : 0;
    const back = here && discount === 0 ? payPlaceCashbackBps(here) : 0;
    return frame(
      "Show your QR",
      <>
        {here && (here.available_cents > 0 || discount > 0 || back > 0) ? (
          <PaySection className="flex items-center gap-3 px-4 py-3" data-pay-code-from>
            <PlacePhoto place={here} className="h-10 w-10" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-base font-semibold">{here.name}</span>
              {here.available_cents > 0 ? (
                <span className="text-muted-foreground block truncate text-sm">{money(here.available_cents, here.currency)} in credits</span>
              ) : null}
            </span>
            {discount > 0 || back > 0 ? (
              <span className={cn("shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold", discount > 0 ? BOX_TINT.discount : BOX_TINT.cashback)}>
                {(discount || back) / 100}% {discount > 0 ? "Discount" : "Cashback"}
              </span>
            ) : null}
          </PaySection>
        ) : null}
        <PaySection className="flex min-h-0 flex-1 flex-col items-center gap-3 p-4 text-center">
          <h2 className="text-base font-semibold" role="status">
            {typing ? "Your waiter is typing the bill" : "Show this to your waiter"}
          </h2>
          <div className="flex min-h-[80px] w-full flex-1 items-center justify-center">
            <div className="flex aspect-square h-full max-h-[340px] max-w-full items-center justify-center rounded-2xl bg-white">
              {code ? (
                <QRCodeSVG value={code.url} size={340} marginSize={0} style={{ width: "100%", height: "100%" }} title="Your Mesita QR" />
              ) : codeFailed ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-muted-foreground text-sm" role="alert">
                    The QR didn&apos;t load.
                  </p>
                  <button
                    type="button"
                    className={cn(QUIET_BUTTON_CLASS, "w-auto")}
                    onClick={() => {
                      setCodeFailed(false);
                      void mint();
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <Skeleton className="h-full min-h-[200px] w-full min-w-[200px] rounded-xl" />
              )}
            </div>
          </div>
          {code && places?.some((p) => p.test_mode) ? (
            <a href={code.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground text-xs font-semibold underline">
              Open as waiter (test)
            </a>
          ) : null}
        </PaySection>
      </>,
      null,
      1,
    );
  }

  const m = (c: number) => money(c, bill.currency);
  const q = bill.quote;
  const placeName = bill.place.name ?? "A Mesita place";
  const secs = Math.max(0, Math.ceil((Date.parse(bill.expires_at) - now) / 1000));
  const left = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const placeRow = (
    <div className="flex items-center gap-3 px-4 py-3">
      <PlacePhoto place={{ photo: bill.place.photo_url, name: placeName }} className="h-10 w-10" />
      <span className="min-w-0 flex-1 truncate text-base font-semibold">{placeName}</span>
    </div>
  );

  // OVER.
  if (bill.state === "cancelled" || bill.state === "expired" || bill.state === "declined" || !q) {
    const words =
      bill.state === "declined" ? "You declined this bill." : bill.state === "expired" ? "Time ran out on this bill." : "This bill was cancelled.";
    return frame(
      bill.state === "declined" ? "Declined" : "Not paid",
      <PaySection className="flex flex-col items-center p-4 text-center">
        <XCircle className={cn("h-10 w-10", BAD)} aria-hidden />
        <p className="mt-2 text-base">{words}</p>
        <p className="text-muted-foreground mt-1 max-w-xs text-sm">
          {bill.state === "declined"
            ? "Your waiter can fix it and send it again. It shows up here."
            : "No credits were used. If you already paid, show this screen to the staff."}
        </p>
      </PaySection>,
      <Button size="lg" className="min-h-12 w-full text-base font-semibold" onClick={again}>
        Show my QR
      </Button>,
      1,
    );
  }

  const rows = (
    <PaySection className="divide-border divide-y text-base" data-pay-bill-rows>
      {placeRow}
      {from && from !== bill.place.id ? (
        <p className="text-muted-foreground px-4 py-2 text-left text-sm">This bill is from {placeName}.</p>
      ) : null}
      <MoneyRow icon={<ReceiptText />} label="Bill" value={m(bill.bill_cents ?? 0)} />
      {q.discount_cents > 0 ? (
        <MoneyRow className={BOX_TINT.discount} icon={<BadgePercent />} label={`${q.discount_bps / 100}% Discount`} value={`−${m(q.discount_cents)}`} />
      ) : null}
      {q.credit_cents > 0 ? <MoneyRow icon={<Wallet />} label="Your credits" value={`−${m(q.credit_cents)}`} /> : null}
      {bill.tip_cents > 0 ? (
        <MoneyRow
          icon={<HandCoins />}
          label={bill.bill_cents ? `Tip · ${Math.round((bill.tip_cents * 100) / bill.bill_cents)}%` : "Tip"}
          value={m(bill.tip_cents)}
        />
      ) : null}
      <MoneyRow icon={<Banknote />} label="Pay at the place" value={m(q.outside_cents)} strong />
      {q.cashback_cents > 0 ? (
        <MoneyRow className={BOX_TINT.cashback} icon={<BadgePercent />} label={`${q.cashback_bps / 100}% Cashback you get`} value={`+${m(q.cashback_cents)}`} />
      ) : null}
    </PaySection>
  );

  // CONFIRMING, or paid and on its way to the receipt.
  if (bill.state === "confirming" || bill.state === "paid") {
    return frame(
      "Confirming…",
      <PaySection className="flex flex-col items-center p-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin motion-reduce:animate-none" aria-hidden />
        <h2 className="mt-2 text-xl font-semibold" role="status">
          Confirming…
        </h2>
      </PaySection>,
      null,
      3,
    );
  }

  // ACCEPTED: pay at the place; the waiter confirms.
  if (bill.state === "accepted") {
    return (
      <>
        {frame(
          "Pay your waiter",
          <>
            <section className="flex w-full shrink-0 items-center gap-3 rounded-2xl bg-[#00D66F] px-4 py-4 text-neutral-950" aria-label={`Pay the place ${m(q.outside_cents)}, cash or card`}>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-base leading-tight font-semibold">Pay at {placeName}</span>
                <span className="block text-sm leading-tight">Cash or their card terminal</span>
              </span>
              <span className="shrink-0 text-2xl font-semibold tabular-nums">{m(q.outside_cents)}</span>
            </section>
            {rows}
            <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm tabular-nums">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Waiting for the waiter to confirm · {left}
            </p>
          </>,
          <button
            type="button"
            className="border-destructive/40 text-destructive hover:bg-destructive/5 bg-card h-11 self-center rounded-xl border px-5 text-sm font-semibold transition disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => setConfirmCancel(true)}
          >
            Cancel bill
          </button>,
          2,
        )}
        <LocalDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} ariaLabel="Cancel this bill">
          <div className="p-5">
            <p className="text-base font-semibold">Cancel this bill?</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {q.credit_cents > 0 ? <li className="text-muted-foreground">Your {m(q.credit_cents)} of credits stay in your Wallet.</li> : null}
              <li className="text-destructive font-semibold">Money you already gave the place is not returned by Mesita. Ask the place for it.</li>
            </ul>
            <CancelBillButtons busy={busy === "cancel"} disabled={busy !== null} onCancel={() => void answer("cancel")} onKeep={() => setConfirmCancel(false)} />
          </div>
        </LocalDialog>
      </>
    );
  }

  // THE BILL: Accept or Decline.
  const nothingOwed = q.outside_cents === 0;
  return frame(
    "Your bill",
    <>
      {rows}
      <p className="text-muted-foreground text-sm tabular-nums">Answer in {left}</p>
      <button type="button" className="text-muted-foreground self-center text-sm font-semibold underline" disabled={busy !== null} onClick={() => void answer("not_mine")}>
        Not my bill
      </button>
    </>,
    <div className="grid gap-2">
      <Button size="lg" className="min-h-12 w-full text-base font-semibold" disabled={busy !== null || now < armedAt} onClick={() => void answer("accept")} data-bill-accept>
        {busy === "accept" ? <Spinner size="sm" label="Accepting" /> : nothingOwed ? `Accept · use ${m(q.credit_cents)} credits` : `Accept · pay ${m(q.outside_cents)} here`}
      </Button>
      <button type="button" className={QUIET_BUTTON_CLASS} disabled={busy !== null} onClick={() => void answer("decline")} data-bill-decline>
        {busy === "decline" ? "Declining…" : "Decline"}
      </button>
    </div>,
    2,
  );
}

/** The screen's shape while it loads. */
export function PayCodeLoading() {
  const router = useRouter();
  return (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col">
      <TicketHeader title="Show your QR" onClose={() => goBack(router)} closeLabel="Close" />
      <div className="flex flex-1 flex-col px-4 py-4">
        <Skeleton className="min-h-0 w-full flex-1 rounded-2xl" aria-hidden />
      </div>
    </div>
  );
}
