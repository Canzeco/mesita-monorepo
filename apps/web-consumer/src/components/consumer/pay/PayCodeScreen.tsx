"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Check, Loader2, Lock, XCircle } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiAnswerBill, apiGetPayCode, type BillTyping, billNeedsGuest, type GuestBill, type PayCode } from "@/lib/api/pay-bill";
import { apiListVisits } from "@/lib/api/tab";
import { money, payPlaceCashbackBps, payPlaceDiscountBps, WALLET_CACHE_KEY } from "@/lib/api/wallet";
import { payBillPath } from "@/lib/consumer-route-contract";
import { goBack, navigateTo } from "@/lib/navigate";
import { fetchCached, invalidateCached } from "@/lib/screen-cache";
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
// The steps read QR · Bill · Pay · Receipt since MESITA-4889.
// FOUR VIEWS (MESITA-4883, Pato: "1. QR 2. Write Bill (observe in real time)
// 3. Pay Bill 4. Receipt"; three under MESITA-4878):
//   1 QR          "Show this to your waiter"; opened from a place, the guest's
//                 credits and rate there and nothing more (MESITA-4881, Pato:
//                 "don't overexplain here")
//   2 Bill      the bill and the tip as the waiter types them, read every
//                 250 ms; shown, never paid
//   3 Pay         what it comes to and the handshake: the guest's Pay and the
//                 waiter's Receive, in any order, then the receipt by itself
//   4 Receipt   /pay/bill/<id>
//   over       declined, cancelled or expired, and the QR again
//
// `from` (a place's Pay Bill) only says what the guest gets there; it is never
// sent: the waiter's phone names the place. Credits are used to the maximum
// and never pay the tip; the server works every number out, and Pay names
// the version on screen.

/** While the waiter types (Pato, MESITA-4890: "every 250 ms is okey"; the read's
 *  own time counts in it), while the QR waits, then with a bill. */
const TYPING_MS = 250;
const LIVE_MS = 1000;
const FAST_MS = 3000;
const SLOW_MS = 5000;
/** A new QR this long before the old one ends. */
const RENEW_MS = 60_000;
/** A bill that just changed can't be accepted by a tap already on its way. */
const REARM_MS = 1000;
const CODE_KEY = "mesita.pay.code";

/** One side of the handshake: a word and an icon, never colour alone. */
function HandshakeSide({ who, ready }: { who: string; ready: boolean }) {
  return (
    <span className="flex w-20 flex-col items-center gap-1 text-center" data-handshake-side={who} data-ready={ready}>
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-300", ready ? "border-[#00D66F] bg-[#00D66F] text-neutral-950" : "border-border text-muted-foreground border-dashed")} aria-hidden>
        {ready ? <Check className="h-6 w-6" strokeWidth={3} /> : <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />}
      </span>
      <span className="text-sm font-semibold">{who}</span>
      <span className={cn("text-xs", ready ? "font-semibold text-green-700" : "text-muted-foreground")}>{ready ? "Ready" : "Waiting"}</span>
    </span>
  );
}

/** An amount that moves as it is typed (MESITA-4886, Pato: "add an animation
 *  that is live"): a character that changed rises into place. */
function LiveAmount({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("inline-flex tabular-nums", className)}>
      <span className="sr-only">{text}</span>
      {[...text].map((ch, i) => (
        <span key={`${i}:${ch}`} className="animate-in fade-in slide-in-from-bottom-2 zoom-in-75 duration-200 motion-reduce:animate-none" aria-hidden>
          {ch}
        </span>
      ))}
    </span>
  );
}

/** Three dots that breathe while the waiter types. */
function LiveDots() {
  return (
    <span className="ml-1 inline-flex items-end gap-1" aria-hidden>
      {["", "[animation-delay:150ms]", "[animation-delay:300ms]"].map((d) => (
        <span key={d} className={cn("bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full motion-reduce:animate-none", d)} />
      ))}
    </span>
  );
}

function keptCode(): PayCode | null {
  try {
    const c = JSON.parse(window.sessionStorage.getItem(CODE_KEY) ?? "null") as PayCode | null;
    return c && Date.parse(c.expires_at) > Date.now() ? c : null;
  } catch {
    return null;
  }
}

/** A QR the server ended is never shown again, even with no signal. */
function dropKeptCode() {
  try {
    window.sessionStorage.removeItem(CODE_KEY);
  } catch {
    // Private mode: nothing was kept.
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
  // Three wrong waiter codes ended this QR (MESITA-4898).
  const [closed, setClosed] = useState(false);
  const [qrOver, setQrOver] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [armedAt, setArmedAt] = useState(0);
  const following = useRef<string | null>(null);
  const seen = useRef("");
  const changedAt = useRef(0);
  const typingNow = useRef(false);
  const alive = useRef(true);
  const reads = useRef(0);
  // The receipt is opened once: a second replace starts it over (MESITA-4891).
  const opened = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const take = useCallback(
    (b: GuestBill | null, t: BillTyping | null, ended = false) => {
      setMisses(0);
      setTyping(t);
      setClosed(ended);
      if (ended) dropKeptCode();
      typingNow.current = t !== null;
      if (!t) setQrOver(false);
      setNow(Date.now());
      const shown = b;
      if (billNeedsGuest(shown)) following.current = shown.id;
      const key = `${shown ? `${shown.id}:${shown.state}:${shown.version}:${shown.waiter_ready === true}` : ""}:${t ? `${t.step}:${t.bill_cents}:${t.tip_cents}` : ""}`;
      if (key !== seen.current) {
        seen.current = key;
        changedAt.current = Date.now();
        setArmedAt(Date.now() + REARM_MS);
      }
      if (shown?.state === "paid" && shown.attempt_id) {
        if (!opened.current) {
          opened.current = true;
          // Tickets and Me read these: this visit and its credits are new.
          invalidateCached(WALLET_CACHE_KEY);
          invalidateCached("activity-visits");
          void fetchCached("activity-visits", () => apiListVisits(getSupabase())).catch(() => {});
          navigateTo(router, payBillPath(shown.attempt_id), { replace: true });
        }
      }
      setBill(shown);
    },
    [router, getSupabase],
  );

  const refresh = useCallback(async () => {
    const n = ++reads.current;
    try {
      const r = await apiGetPayCode(getSupabase(), following.current ? { bill_id: following.current } : {});
      if (alive.current && n === reads.current) take(r.bill, r.typing ?? null, r.closed === true);
    } catch {
      if (alive.current) setMisses((x) => x + 1);
    }
  }, [getSupabase, take]);

  const mint = useCallback(async () => {
    try {
      const r = await apiGetPayCode(getSupabase(), { mint: true, ...(from ? { place_id: from } : {}), ...(following.current ? { bill_id: following.current } : {}) });
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
      reads.current++;
      take(r.bill, r.typing ?? null, r.closed === true);
    } catch {
      if (!alive.current) return;
      // No signal: the last QR still works until it ends.
      const kept = keptCode();
      if (kept) setCode(kept);
      else setCodeFailed(true);
    }
  }, [getSupabase, take, from]);

  const busyBill = billNeedsGuest(bill);
  const rescan = showAgain && bill?.state === "accepted";
  const showing = !bill || bill.state === "open" || rescan;

  useEffect(() => {
    const id = setTimeout(() => void mint(), 0);
    return () => clearTimeout(id);
  }, [mint]);

  // A new QR before this one ends, while it is the one on screen.
  useEffect(() => {
    if (!code || !showing || closed) return;
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
  }, [code, showing, closed, mint]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const started = Date.now();
      if (opened.current) return;
      if (document.visibilityState === "visible") await refresh();
      if (alive.current && !opened.current) timer = setTimeout(() => void loop(), Date.now() - changedAt.current > 120_000 ? SLOW_MS : following.current ? (Date.now() - changedAt.current < 30_000 ? LIVE_MS : FAST_MS) : typingNow.current ? Math.max(TYPING_MS - (Date.now() - started), 0) : LIVE_MS);
    };
    timer = setTimeout(() => void loop(), LIVE_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && !opened.current) void refresh();
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
        dropKeptCode();
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
              {bill?.state === "accepted" || bill?.state === "confirming" || bill?.waiter_ready ? "Checking… Don't pay again. Ask your waiter if it went through." : "No connection. If it stays, pay normally: nothing was used."}
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

  if (closed && !billNeedsGuest(bill)) {
    return frame(
      "Ticket closed",
      <PaySection className="flex flex-col items-center p-4 text-center" data-pay-closed>
        <XCircle className={cn("h-10 w-10", BAD)} aria-hidden />
        <p className="mt-2 text-base" role="status">Too many wrong waiter codes.</p>
        <p className="text-muted-foreground mt-1 max-w-xs text-sm">Nothing was paid. Show a new QR to try again.</p>
      </PaySection>,
      <Button size="lg" className="min-h-12 w-full text-base font-semibold" onClick={again}>
        New QR
      </Button>,
      1,
    );
  }

  // WRITE BILL: the waiter scanned and is typing. An open bill nobody types on
  // was left: the QR again, never $0.00.
  const writing = !rescan && (!bill || bill.state === "open") && !qrOver && typing !== null;
  if (writing) {
    const shown = (c: number) => money(c, here?.currency ?? "mxn");
    const t = typing;
    const row = (label: string, cents: number, on: boolean, empty: string) => (
      <div className={cn("flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-4 transition-all duration-300", on ? "border-[#00D66F] bg-[#00D66F]/10" : "border-border")} data-write-bill-row={label}>
        <dt className={cn("text-base font-semibold", !on && "text-muted-foreground")}>{label}</dt>
        <dd className={cn("flex items-center gap-1 text-2xl font-bold tabular-nums", cents === 0 && "text-muted-foreground")}>
          <LiveAmount text={cents > 0 ? shown(cents) : empty} />
          {on ? <span className="h-7 w-0.5 animate-pulse rounded-full bg-[#00A85A] motion-reduce:animate-none" aria-hidden /> : null}
        </dd>
      </div>
    );
    return frame(
      "Bill",
      <section className="flex min-h-fit flex-1 flex-col justify-center gap-4 py-4" data-write-bill={t.step}>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="mb-2 flex items-center gap-2 rounded-full bg-[#00D66F]/15 px-3 py-1 text-sm font-semibold">
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00D66F] opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00A85A]" />
            </span>
            Live
          </p>
          <p className="text-muted-foreground text-base" role="status">
            {t.step === "bill" ? "Your waiter is writing your bill" : t.step === "tip" ? "Your waiter is writing the tip" : "Your bill is ready"}
            {t.step === "code" ? null : <LiveDots />}
          </p>
          <p className={cn("leading-tight font-bold tracking-tight tabular-nums", shown(t.bill_cents + t.tip_cents).length > 10 ? "text-4xl" : "text-5xl")}>
            <LiveAmount text={shown(t.bill_cents + t.tip_cents)} />
          </p>
        </div>
        <dl className="flex flex-col gap-2">
          {row("Bill", t.bill_cents, t.step === "bill", shown(0))}
          {row("Tip", t.tip_cents, t.step === "tip", t.step === "code" ? "No tip" : shown(0))}
        </dl>
        {/* THE WAITER'S CODE (Pato, 2026-11-24, MESITA-4889: "in a discreet way,
            like waiter is authenticating, below tip"): that it is being typed,
            never a digit nor how many. */}
        <p className={cn("text-muted-foreground flex min-h-6 items-center justify-center gap-2 text-sm transition-opacity duration-500", t.step !== "code" && "opacity-0")} aria-hidden={t.step !== "code"} data-waiter-code>
          <Lock className="h-4 w-4 animate-pulse motion-reduce:animate-none" aria-hidden />
          Your waiter is entering their code
          <LiveDots />
        </p>
        <p className="text-muted-foreground text-center text-sm">You check it and pay next. Nothing is paid yet.</p>
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
  const took = bill.took_cents ?? null;
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
            ? "Your waiter can fix it and send it again. It shows up here." + (took !== null && took > 0 ? ` If you paid ${m(took)}, ask for it back.` : "")
            : took !== null && took > 0
                ? `No credits were used. Your waiter said they took ${m(took)}. Show them this screen.`
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
  const line = (label: string, value: string, good = false) => (
    <div className={cn("flex min-h-11 items-center justify-between gap-3", good && "font-semibold text-green-700")}>
      <dt className={cn("truncate", !good && "text-muted-foreground")}>{label}</dt>
      <dd className={cn("shrink-0", !good && "font-semibold")}>{value}</dd>
    </div>
  );
  // ONE TICKET (Pato, 2026-11-24, MESITA-4886: "better design in those"): the
  // black top is the Wallet's Balance card, the place and what the guest pays;
  // its lines hang from it. The waiter's screen draws the same ticket.
  const ticket = (words: string) => (
    <section className="border-border w-full shrink-0 overflow-hidden rounded-3xl border text-left" aria-label={`${words} ${big}`} data-pay-bill-ticket>
      <div className="bg-foreground text-background flex flex-col gap-4 px-5 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <PlacePhoto place={{ photo: bill.place.photo_url, name: placeName }} className="h-11 w-11" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold">{placeName}</span>
            {from && from !== bill.place.id ? <span className="block truncate text-sm opacity-70">Not the place you opened</span> : null}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-base opacity-70">{nothingOwed ? "Paid with your credits" : words}</p>
          <p className={cn("leading-tight font-bold tracking-tight tabular-nums", big.length > 10 ? "text-4xl" : "text-5xl")}>{big}</p>
          {saved ? <p className="mt-2 self-start rounded-full bg-[#00D66F] px-3 py-1 text-sm font-semibold text-neutral-950 tabular-nums" data-pay-bill-saved>{saved}</p> : null}
        </div>
      </div>
      <dl className="divide-border bg-card divide-y px-5 py-1 text-base tabular-nums" data-pay-bill-rows>
        {line("Bill", m(bill.bill_cents ?? 0))}
        {q.discount_cents > 0 ? line(`${q.discount_bps / 100}% Discount`, `−${m(q.discount_cents)}`, true) : null}
        {q.credit_cents > 0 ? line("Your credits", `−${m(q.credit_cents)}`, true) : null}
        {bill.tip_cents > 0
          ? line(bill.bill_cents ? `Tip · ${Math.round((bill.tip_cents * 100) / bill.bill_cents)}%` : "Tip", m(bill.tip_cents))
          : null}
        {q.cashback_cents > 0 ? line(q.cashback_capped ? "Cashback (maximum)" : `${q.cashback_bps / 100}% Cashback`, `+${m(q.cashback_cents)}`, true) : null}
      </dl>
    </section>
  );

  // THE HANDSHAKE (Pato, 2026-11-24, MESITA-4889: "a screen that waits for both
  // sides to confirm, not sequential order, but just both sides to coincide").
  const changed = took !== null && !bill.waiter_ready && took !== q.outside_cents;
  const changedLine = changed ? (
    <p className="shrink-0 text-center text-sm font-semibold text-amber-700" role="status">
      The bill changed. Your waiter took {m(took)}; now it is {m(q.outside_cents)}.
    </p>
  ) : null;
  const handshake = (
    <div className="border-border flex shrink-0 items-center rounded-2xl border px-4 py-3" role="status" data-handshake>
      <HandshakeSide who="You" ready={bill.state === "accepted"} />
      <span className={cn("h-0.5 flex-1 rounded-full", bill.state === "accepted" || bill.waiter_ready ? "bg-[#00D66F]" : "bg-border")} aria-hidden />
      <HandshakeSide who="Waiter" ready={bill.waiter_ready === true} />
    </div>
  );

  // CONFIRMING, or paid and on its way to the receipt.
  if (bill.state === "confirming" || bill.state === "paid") {
    return frame(
      bill.state === "paid" ? "Paid" : "Confirming…",
      <PaySection className="flex flex-col items-center p-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin motion-reduce:animate-none" aria-hidden />
        <h2 className="mt-2 text-xl font-semibold" role="status">
          {bill.state === "paid" ? "Paid. Opening your receipt…" : "Confirming…"}
        </h2>
      </PaySection>,
      bill.state === "paid" && bill.attempt_id ? (
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => navigateTo(router, payBillPath(bill.attempt_id ?? ""), { replace: true })}>
          See receipt
        </button>
      ) : null,
      3,
    );
  }

  // ACCEPTED: pay at the place; the waiter confirms.
  if (bill.state === "accepted") {
    return (
      <>
        {frame(
          "Pay",
          <>
            {ticket("Pay your waiter, cash or card")}
            {handshake}
            {changedLine}
            <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm tabular-nums">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              Waiting for your waiter · {left}
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

  // THE BILL: Pay or Decline. Their Pay closes it when the waiter is ready.
  return frame(
    "Pay",
    <>
      {ticket("Pay your waiter, cash or card")}
      {handshake}
      {changedLine}
      <p className="text-muted-foreground flex shrink-0 items-center justify-center gap-2 text-sm tabular-nums">
        Answer in {left}
        <span aria-hidden>·</span>
        <button type="button" className="min-h-11 font-semibold underline underline-offset-2" disabled={busy !== null} onClick={() => void answer("not_mine")}>
          Not my bill
        </button>
      </p>
    </>,
    // Decline a third, Pay two thirds: one clear next step.
    <div className="grid grid-cols-[1fr_2fr] gap-2">
      <button type="button" className={QUIET_BUTTON_CLASS} disabled={busy !== null} onClick={() => void answer("decline")} data-bill-decline>
        {busy === "decline" ? <Spinner size="sm" label="Declining" /> : "Decline"}
      </button>
      <Button
        size="lg"
        className="min-h-12 w-full rounded-2xl bg-[#00D66F] text-base font-semibold text-neutral-950 hover:bg-[#00c265]"
        disabled={busy !== null || now < armedAt}
        onClick={() => void answer("accept")}
        aria-label={nothingOwed ? `Use ${m(q.credit_cents)} of my credits` : `I paid ${m(q.outside_cents)} to my waiter`}
        data-bill-accept
      >
        {busy === "accept" ? <Spinner size="sm" label="Confirming" /> : nothingOwed ? "Use my credits" : `I paid ${big}`}
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
