"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, XCircle } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiAnswerBill, apiGetPayCode, type BillTyping, billNeedsGuest, type GuestBill, type PayCode } from "@/lib/api/pay-bill";
import { money, payPlaceCashbackBps, payPlaceDiscountBps } from "@/lib/api/wallet";
import { payBillPath } from "@/lib/consumer-route-contract";
import { goBack, navigateTo } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useWakeLock } from "@/lib/use-wake-lock";
import { cn } from "@/lib/utils";
import { BAD, BOX_TINT, PaySection, StepBody, StepStrip, TicketHeader } from "./pay-flow";
import { CancelBillButtons, NETWORK_FAILURE, PlacePhoto, QUIET_BUTTON_CLASS } from "./pay-common";
import { usePayPlaces } from "./use-pay-places";

// THE WAITER LEADS (Pato, 2026-11-24, MESITA-4823): /pay/code. The guest's one
// general Mesita QR, never a place's; the waiter scans it and sends the bill;
// this same screen becomes the bill:
//
// FOUR VIEWS (MESITA-4883, Pato: "1. QR 2. Write Bill (observe in real time)
// 3. Pay Bill 4. Receipt"; three under MESITA-4878):
//   1 QR          "Show this to your waiter"; opened from a place, the guest's
//                 credits and rate there and nothing more (MESITA-4881, Pato:
//                 "don't overexplain here")
//   2 Write Bill  the bill and the tip as the waiter types them, read every
//                 half second; shown, never paid
//   3 Pay Bill    what it comes to, Accept or Decline; then Pay $X at the place,
//                 which only the waiter confirms
//   4 Receipt   /pay/bill/<id>
//   over       declined, cancelled or expired, and the QR again
//
// `from` (a place's Pay Bill) only says what the guest gets there; it is never
// sent: the waiter's phone names the place. Credits are used to the maximum
// and never pay the tip; the server works every number out, and Accept names
// the version on screen.

/** While the waiter types (Pato, MESITA-4883: "every 500ms … to simulate real
 *  time writing"), while the QR waits, then with a bill. */
const TYPING_MS = 500;
const LIVE_MS = 1000;
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
  // The waiter lost the bill's page: the QR again, for the accepted bill (MESITA-4831).
  const [showAgain, setShowAgain] = useState(false);
  const [typing, setTyping] = useState<BillTyping | null>(null);
  // The guest wants the QR back while the waiter types.
  const [qrOver, setQrOver] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [armedAt, setArmedAt] = useState(0);
  const following = useRef<string | null>(null);
  const seen = useRef("");
  const changedAt = useRef(0);
  const typingNow = useRef(false);
  const alive = useRef(true);
  const reads = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const take = useCallback(
    (b: GuestBill | null, t: BillTyping | null) => {
      setMisses(0);
      setTyping(t);
      typingNow.current = t !== null;
      if (!t) setQrOver(false);
      setNow(Date.now());
      const shown = b;
      if (billNeedsGuest(shown)) following.current = shown.id;
      const key = `${shown ? `${shown.id}:${shown.state}:${shown.version}` : ""}:${t ? `${t.step}:${t.bill_cents}:${t.tip_cents}` : ""}`;
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
      if (alive.current && n === reads.current) take(r.bill, r.typing ?? null);
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
      take(r.bill, r.typing ?? null);
    } catch {
      if (!alive.current) return;
      // No signal: the last QR still works until it ends.
      const kept = keptCode();
      if (kept) setCode(kept);
      else setCodeFailed(true);
    }
  }, [getSupabase, take]);

  const busyBill = billNeedsGuest(bill);
  const rescan = showAgain && bill?.state === "accepted";
  const showing = !bill || bill.state === "open" || rescan;

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
      if (alive.current) timer = setTimeout(() => void loop(), Date.now() - changedAt.current > 120_000 ? SLOW_MS : following.current ? FAST_MS : typingNow.current ? TYPING_MS : LIVE_MS);
    };
    timer = setTimeout(() => void loop(), LIVE_MS);
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
    setShowAgain(false);
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

  // WRITE BILL: the waiter scanned and is typing.
  const writing = !rescan && (!bill || bill.state === "open") && !qrOver && (typing !== null || bill?.state === "open");
  if (writing) {
    const shown = (c: number) => money(c, here?.currency ?? "mxn");
    const t = typing ?? { bill_cents: 0, tip_cents: 0, step: "code" as const };
    const row = (label: string, cents: number, on: boolean, empty: string) => (
      <div className={cn("flex items-center justify-between gap-3 rounded-2xl border px-4 py-4 transition", on ? "border-foreground" : "border-border")} data-write-bill-row={label}>
        <dt className={cn("text-base font-semibold", !on && "text-muted-foreground")}>{label}</dt>
        <dd className={cn("flex items-center gap-1 text-2xl font-bold tabular-nums", cents === 0 && "text-muted-foreground")}>
          {cents > 0 ? shown(cents) : empty}
          {on ? <span className="bg-foreground h-6 w-0.5 animate-pulse motion-reduce:animate-none" aria-hidden /> : null}
        </dd>
      </div>
    );
    return frame(
      "Write Bill",
      <section className="flex min-h-fit flex-1 flex-col justify-center gap-4 py-4" data-write-bill={t.step}>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-muted-foreground text-base" role="status">
            {t.step === "bill" ? "Your waiter is writing your bill" : t.step === "tip" ? "Your waiter is writing the tip" : "Your waiter is about to send it"}
          </p>
          <p className={cn("leading-tight font-bold tracking-tight tabular-nums", shown(t.bill_cents + t.tip_cents).length > 10 ? "text-4xl" : "text-5xl")}>{shown(t.bill_cents + t.tip_cents)}</p>
        </div>
        <dl className="flex flex-col gap-2">
          {row("Bill", t.bill_cents, t.step === "bill", shown(0))}
          {row("Tip", t.tip_cents, t.step === "tip", t.step === "code" ? "No tip" : shown(0))}
        </dl>
        <p className="text-muted-foreground text-center text-sm">You check it and accept it next. Nothing is paid yet.</p>
      </section>,
      <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => setQrOver(true)}>
        Show my QR
      </button>,
      2,
    );
  }

  // THE QR.
  if (!bill || bill.state === "open" || rescan) {
    const discount = here ? payPlaceDiscountBps(here) : 0;
    const back = here && discount === 0 ? payPlaceCashbackBps(here) : 0;
    return frame(
      "Your QR",
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
            Show this to your waiter
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
      rescan ? (
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => setShowAgain(false)}>
          Back to the bill
        </button>
      ) : null,
      rescan ? 3 : 1,
    );
  }

  const m = (c: number) => money(c, bill.currency);
  const q = bill.quote;
  const placeName = bill.place.name ?? "A Mesita place";
  const secs = Math.max(0, Math.ceil((Date.parse(bill.expires_at) - now) / 1000));
  const left = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
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

  // THE AMOUNT FIRST (Pato, 2026-11-24, MESITA-4882: "make this design
  // better"): the place, what the guest pays and how, large and alone; under it
  // what it is made of, a plain receipt. Every number is the server's.
  const nothingOwed = q.outside_cents === 0;
  const big = m(nothingOwed ? q.credit_cents : q.outside_cents);
  const saved = q.discount_cents > 0 ? `You save ${m(q.discount_cents)}` : q.cashback_cents > 0 ? `You get ${m(q.cashback_cents)} cashback` : null;
  const hero = (words: string) => (
    <section className="flex min-h-fit flex-1 flex-col items-center justify-center gap-1 py-4 text-center [@media(max-height:740px)]:py-0" aria-label={`${words} ${m(q.outside_cents)}`} data-pay-bill-hero>
      <PlacePhoto place={{ photo: bill.place.photo_url, name: placeName }} className="h-16 w-16 [@media(max-height:740px)]:h-11 [@media(max-height:740px)]:w-11" />
      <p className="mt-1 max-w-full truncate text-base font-semibold">{placeName}</p>
      {from && from !== bill.place.id ? <p className="text-muted-foreground text-sm">This bill is from {placeName}.</p> : null}
      <p className="text-muted-foreground mt-2 text-base">{nothingOwed ? "Paid with your credits" : words}</p>
      <p className={cn("leading-tight font-bold tracking-tight tabular-nums", big.length > 10 ? "text-4xl" : "text-5xl")}>{big}</p>
      {saved ? (
        <p className={cn("mt-2 rounded-full px-3.5 py-1.5 text-sm font-semibold tabular-nums", q.discount_cents > 0 ? BOX_TINT.discount : BOX_TINT.cashback)} data-pay-bill-saved>
          {saved}
        </p>
      ) : null}
    </section>
  );
  const line = (label: string, value: string, good = false) => (
    <div className={cn("flex items-baseline justify-between gap-3", good ? "font-semibold text-green-700" : "text-muted-foreground")}>
      <dt className="truncate">{label}</dt>
      <dd className={cn("shrink-0", !good && "text-foreground")}>{value}</dd>
    </div>
  );
  const rows = (
    <dl className="bg-muted/60 flex w-full shrink-0 flex-col gap-1.5 rounded-2xl px-4 py-3 text-left text-base tabular-nums" data-pay-bill-rows>
      {line("Bill", m(bill.bill_cents ?? 0))}
      {q.discount_cents > 0 ? line(`${q.discount_bps / 100}% Discount`, `−${m(q.discount_cents)}`, true) : null}
      {q.credit_cents > 0 ? line("Your credits", `−${m(q.credit_cents)}`, true) : null}
      {bill.tip_cents > 0
        ? line(bill.bill_cents ? `Tip · ${Math.round((bill.tip_cents * 100) / bill.bill_cents)}%` : "Tip", m(bill.tip_cents))
        : null}
      {q.cashback_cents > 0 ? line(q.cashback_capped ? "Cashback (maximum)" : `${q.cashback_bps / 100}% Cashback`, `+${m(q.cashback_cents)}`, true) : null}
    </dl>
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
          "Pay Bill",
          <>
            {hero("Pay your waiter, cash or card")}
            {rows}
            <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm tabular-nums">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Waiting for the waiter to confirm · {left}
            </p>
          </>,
          <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className={cn(QUIET_BUTTON_CLASS, "h-11 w-auto px-5")}
            onClick={() => {
              setShowAgain(true);
              void mint();
            }}
          >
            Show my QR
          </button>
          <button
            type="button"
            className="border-destructive/40 text-destructive hover:bg-destructive/5 bg-card h-11 self-center rounded-xl border px-5 text-sm font-semibold transition disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => setConfirmCancel(true)}
          >
            Cancel bill
          </button>
          </div>,
          3,
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
  return frame(
    "Pay Bill",
    <>
      {hero("You pay your waiter, cash or card")}
      {rows}
      <p className="text-muted-foreground flex shrink-0 items-center justify-center gap-2 text-sm tabular-nums [@media(max-height:740px)]:-my-3">
        Answer in {left}
        <span aria-hidden>·</span>
        <button type="button" className="min-h-11 font-semibold underline underline-offset-2" disabled={busy !== null} onClick={() => void answer("not_mine")}>
          Not my bill
        </button>
      </p>
    </>,
    // Decline a third, Accept two thirds: one clear next step.
    <div className="grid grid-cols-[1fr_2fr] gap-2">
      <button type="button" className={QUIET_BUTTON_CLASS} disabled={busy !== null} onClick={() => void answer("decline")} data-bill-decline>
        {busy === "decline" ? <Spinner size="sm" label="Declining" /> : "Decline"}
      </button>
      <Button
        size="lg"
        className="min-h-12 w-full rounded-2xl bg-[#00D66F] text-base font-semibold text-neutral-950 hover:bg-[#00c265]"
        disabled={busy !== null || now < armedAt}
        onClick={() => void answer("accept")}
        aria-label={nothingOwed ? `Accept, use ${m(q.credit_cents)} of credits` : `Accept, pay ${m(q.outside_cents)} here`}
        data-bill-accept
      >
        {busy === "accept" ? <Spinner size="sm" label="Accepting" /> : "Accept"}
      </Button>
    </div>,
    3,
  );
}

/** The screen's shape while it loads. */
export function PayCodeLoading() {
  const router = useRouter();
  return (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col">
      <TicketHeader title="Your QR" onClose={() => goBack(router)} closeLabel="Close" />
      <div className="flex flex-1 flex-col px-4 py-4">
        <Skeleton className="min-h-0 w-full flex-1 rounded-2xl" aria-hidden />
      </div>
    </div>
  );
}
