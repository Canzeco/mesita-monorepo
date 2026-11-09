"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TEST_BAND_TEXT, TestBand } from "@mesita/place-profile";
import { clockTime, readAmount } from "@mesita/place-profile/lib/money";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiCancelTab, apiGetTab, apiOpenTab, apiPayTab, TAB_REFUSAL, tabSplit, type GuestTab } from "@/lib/api/tab";
import { money } from "@/lib/api/wallet";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { LiveClock } from "./LiveClock";

// PAY AT THE TABLE, THE GUEST'S SCREENS (MESITA-3564; the backend is
// MESITA-3567/3568/3562, Docs › Credits "Pay at the table").
//
// 1. "Show this to the waiter": a big QR of the waiter's link
//    (consumer-web-open-tab), "Waiting for the bill". The waiter scans it on
//    visit.mesita.ai and types the bill and a tip suggestion.
// 2. Billed: one screen. The tip (the waiter's suggestion picked, 10/15/20%,
//    Other, No tip: the guest decides), how the bill is paid (the guest's
//    credit here first, on by default, the rest in cash) and how the tip is
//    paid (cash; credits never pay a tip), what comes back (2% of the cash
//    bill part, never the tip) and one button "Pay $total".
// 3. A cash part: "Give the waiter $C in cash" until the waiter taps
//    Received; "Change how I pay" undoes it before then.
// 4. Paid: full screen green-700, the amount, the time, the place, the
//    cashback and a live clock.
//
// No websocket: the screen re-reads the tab (consumer-web-get-tab) every
// 1.5 s, 5 s after a minute without a change, 10 s after five; it stops
// while the page is hidden and once the tab is final, and reads once on
// coming back. Two failed reads in a row say "Reconnecting…". A card part
// arrives with MESITA-3563: until get-tab says card_available, Card is not
// offered.

const FAST_MS = 1_500;
const MID_MS = 5_000;
const SLOW_MS = 10_000;
const FINAL = new Set(["paid", "expired", "cancelled"]);
const NETWORK_FAILURE = "Couldn't reach Mesita. Tap again.";
const TIP_PERCENTS = [10, 15, 20] as const;
type TipChoice = "waiter" | (typeof TIP_PERCENTS)[number] | "other" | "none";

const FIELD_CLASS =
  "border-border bg-background text-foreground placeholder:text-muted-foreground h-12 w-full rounded-xl border px-3 text-base outline-none focus:border-foreground";
const QUIET_BUTTON_CLASS =
  "border-border bg-card hover:bg-muted min-h-12 w-full rounded-2xl border px-4 text-base font-semibold transition";

export type TabStart = { kind: "place"; placeId: string } | { kind: "tab"; tabId: string };

/** A clock that moves every 15 s, for "N min left". */
function useMinuteNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Keeps the screen on while the QR waits to be scanned, where the browser can. */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const take = () => {
      void (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) void l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };
    take();
    const onVisible = () => {
      if (!document.hidden) take();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (lock) void lock.release().catch(() => {});
    };
  }, [on]);
}

export function TabView({
  start,
  getSupabase,
  canUseCode,
  onTabId,
  onWaiterCode,
  onDone,
}: {
  start: TabStart;
  getSupabase: () => Parameters<typeof apiGetTab>[0];
  /** Whether the waiter's 4-digit code (MESITA-3306) can pay at this place. */
  canUseCode: (placeId: string) => boolean;
  /** The tab's id, for `/pay?tab=<id>` (a reload shows the same tab). */
  onTabId: (tabId: string) => void;
  onWaiterCode: (placeId: string) => void;
  onDone: () => void;
}) {
  const [tabId, setTabId] = useState<string | null>(start.kind === "tab" ? start.tabId : null);
  const [qr, setQr] = useState<string | null>(null);
  const [tab, setTab] = useState<GuestTab | null>(null);
  const [failures, setFailures] = useState(0);
  const [gone, setGone] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);
  const lastChange = useRef({ at: 0, key: "" });

  /** Opens (or reuses) the guest's tab at a place: a fresh QR. */
  function open(placeId: string) {
    return apiOpenTab(getSupabase(), placeId)
      .then((o) => {
        setOpenFailed(false);
        setTabId(o.tab_id);
        setQr(o.qr_url);
        onTabId(o.tab_id);
        return o;
      })
      .catch((e) => {
        if (e instanceof EFError && e.code === "gone") {
          toast("This place can't take payments right now.", { tone: "error" });
          onDone();
        } else {
          setOpenFailed(true);
        }
        return null;
      });
  }

  // Boot: a picked place opens its tab; a reloaded `/pay?tab=` reads it and,
  // while it still waits for the bill, opens again for a fresh QR (the QR's
  // secret is never stored on the device).
  useEffect(() => {
    let cancelled = false;
    if (start.kind === "place") {
      void open(start.placeId);
    } else {
      void apiGetTab(getSupabase(), start.tabId)
        .then((t) => {
          if (cancelled) return;
          setTab(t);
          if (t.status === "waiting_bill") void open(t.place.id);
        })
        .catch((e) => {
          if (cancelled) return;
          if (e instanceof EFError && (e.status === 404 || e.status === 403)) setGone(true);
          else setOpenFailed(true);
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const final = tab !== null && FINAL.has(tab.status);

  // The poll: a setTimeout chain, fast while things move, slower when they
  // don't; paused while hidden; stopped when the tab is final.
  useEffect(() => {
    if (!tabId || final || gone) return;
    if (!lastChange.current.at) lastChange.current.at = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () =>
      apiGetTab(getSupabase(), tabId)
        .then((t) => {
          if (cancelled) return;
          const key = `${t.status}|${t.updated_at}`;
          if (key !== lastChange.current.key) lastChange.current = { at: Date.now(), key };
          setFailures(0);
          setTab(t);
        })
        .catch((e) => {
          if (cancelled) return;
          if (e instanceof EFError && (e.status === 404 || e.status === 403)) {
            setGone(true);
            return;
          }
          setFailures((n) => n + 1);
        });
    const delay = () => {
      const quiet = Date.now() - lastChange.current.at;
      return quiet < 60_000 ? FAST_MS : quiet < 300_000 ? MID_MS : SLOW_MS;
    };
    const tick = () => {
      if (cancelled || document.hidden) return;
      void read().then(() => {
        if (!cancelled) timer = setTimeout(tick, delay());
      });
    };
    timer = setTimeout(tick, nonce > 0 ? 0 : FAST_MS);
    const onVisible = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (document.hidden) return;
      lastChange.current.at = Date.now();
      tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, final, gone, nonce]);

  /** Read now (after a tap), then keep polling fast. */
  function readNow() {
    lastChange.current.at = Date.now();
    setNonce((n) => n + 1);
  }

  const status = tab?.status ?? (qr ? "waiting_bill" : null);
  useWakeLock(status === "waiting_bill");

  async function cancel(mode: "cancel" | "change") {
    if (!tabId) return;
    setBusy(true);
    try {
      await apiCancelTab(getSupabase(), tabId, mode);
      if (mode === "cancel") onDone();
      else readNow();
    } catch (e) {
      toast(e instanceof EFError && e.code ? (TAB_REFUSAL[e.code] ?? e.message) : NETWORK_FAILURE, { tone: "error" });
      readNow();
    } finally {
      setBusy(false);
    }
  }

  async function payWithCode(placeId: string) {
    if (tabId) await apiCancelTab(getSupabase(), tabId, "cancel").catch(() => {});
    onWaiterCode(placeId);
  }

  async function reopen(placeId: string) {
    setTab(null);
    setQr(null);
    lastChange.current = { at: Date.now(), key: "" };
    await open(placeId);
  }

  const reconnecting = failures >= 2;
  const placeName = tab?.place.name ?? "this place";

  if (gone) {
    return (
      <Shell onBack={onDone}>
        <p className="border-border bg-card rounded-2xl border px-4 py-4 text-base font-semibold" role="status">
          This bill isn&apos;t on your account
        </p>
        <Button size="lg" className="mt-6 w-full text-base font-semibold" onClick={onDone}>
          Done
        </Button>
      </Shell>
    );
  }

  if (openFailed && !tab) {
    return (
      <Shell onBack={onDone}>
        <p className="border-border bg-card rounded-2xl border px-4 py-4 text-base font-semibold" role="status">
          Couldn&apos;t open your bill. Check your connection.
        </p>
        <Button
          size="lg"
          className="mt-6 w-full text-base font-semibold"
          onClick={() => {
            setOpenFailed(false);
            if (start.kind === "place") void open(start.placeId);
            else window.location.reload();
          }}
        >
          Try again
        </Button>
      </Shell>
    );
  }

  if (status === "waiting_bill") {
    const placeId = tab?.place.id ?? (start.kind === "place" ? start.placeId : null);
    return (
      <Shell onBack={onDone} testMode={tab?.test_mode ?? false}>
        <QrScreen
          qr={qr}
          placeName={tab?.place.name ?? null}
          expiresAt={tab?.expires_at ?? null}
          reconnecting={reconnecting}
        />
        {placeId && canUseCode(placeId) ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mx-auto mt-4 flex min-h-11 items-center text-sm font-semibold underline"
            onClick={() => void payWithCode(placeId)}
            data-charge-code-link
          >
            Waiter gave you a code?
          </button>
        ) : null}
        <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-4")} disabled={busy || !tabId} onClick={() => void cancel("cancel")}>
          Cancel
        </button>
      </Shell>
    );
  }

  if (!tab) {
    return (
      <Shell onBack={onDone}>
        <div className="border-border bg-card flex flex-col items-center rounded-2xl border px-6 py-6" aria-busy>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-64 w-64 rounded-xl" />
          <Skeleton className="mt-5 h-4 w-32" />
        </div>
      </Shell>
    );
  }

  if (tab.status === "billed") {
    return (
      <Shell onBack={onDone} testMode={tab.test_mode}>
        <SplitScreen
          key={tab.bill_version}
          tab={tab}
          getSupabase={getSupabase}
          reconnecting={reconnecting}
          onTapped={readNow}
          onCancel={() => void cancel("cancel")}
          busyCancel={busy}
        />
      </Shell>
    );
  }

  if (tab.status === "paying") {
    return (
      <Shell onBack={onDone} testMode={tab.test_mode}>
        <CashScreen tab={tab} reconnecting={reconnecting} busy={busy} onChange={() => void cancel("change")} />
      </Shell>
    );
  }

  if (tab.status === "paid") return <PaidScreen tab={tab} onDone={onDone} />;

  // Expired or cancelled.
  const expired = tab.status === "expired";
  return (
    <Shell onBack={onDone} testMode={tab.test_mode}>
      <div className="border-border bg-card rounded-2xl border px-4 py-4" role="status">
        <p className="text-base font-semibold">{expired ? "This bill expired" : "This bill was cancelled"}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {expired ? `Nothing was paid at ${placeName}. A bill closes 30 minutes after it opens.` : `Nothing was paid at ${placeName}.`}
        </p>
      </div>
      <Button size="lg" className="mt-6 w-full text-base font-semibold" onClick={() => void reopen(tab.place.id)}>
        Open a new bill
      </Button>
      <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} onClick={onDone}>
        Done
      </button>
    </Shell>
  );
}

function Shell({ onBack, testMode = false, children }: { onBack: () => void; testMode?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col" data-pay-tab>
      <button
        type="button"
        aria-label="Back to places"
        onClick={onBack}
        className="hover:bg-muted -ml-2 mb-2 flex h-11 w-11 items-center justify-center rounded-full"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </button>
      {testMode ? <TestBand className="mb-3" /> : null}
      {children}
    </div>
  );
}

/** A small decorative spinner beside a live status line. */
function Dot() {
  return <span className="border-muted border-t-foreground h-4 w-4 shrink-0 animate-spin rounded-full border-2" aria-hidden />;
}

function ReconnectingLine({ on }: { on: boolean }) {
  return on ? (
    <p className="text-muted-foreground mt-2 text-center text-sm" role="status">
      Reconnecting…
    </p>
  ) : null;
}

// ── 1. The QR ────────────────────────────────────────────────────────────────

function QrScreen({
  qr,
  placeName,
  expiresAt,
  reconnecting,
}: {
  qr: string | null;
  placeName: string | null;
  expiresAt: string | null;
  reconnecting: boolean;
}) {
  const now = useMinuteNow();
  const minsLeft = expiresAt ? Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60_000)) : null;
  return (
    <div className="border-border bg-card flex flex-col items-center rounded-2xl border px-4 py-6 text-center">
      {placeName ? <p className="text-base font-semibold">{placeName}</p> : null}
      <p className="font-display mt-1 text-2xl font-semibold">Show this to the waiter</p>
      <div className="mt-5 rounded-xl bg-white p-4">
        {qr ? (
          <QRCodeSVG value={qr} size={256} marginSize={0} aria-label="Your bill's QR for the waiter" data-tab-qr />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center">
            <Spinner size="sm" label="Opening your bill" />
          </div>
        )}
      </div>
      <p className="mt-5 flex items-center gap-2 text-base font-semibold" role="status" aria-live="polite">
        <Dot />
        Waiting for the bill
      </p>
      {minsLeft !== null && minsLeft <= 10 ? (
        <p className="text-muted-foreground mt-1 text-sm">{minsLeft} min left</p>
      ) : null}
      <p className="text-muted-foreground mt-3 text-sm">Turn up your brightness if it doesn&apos;t scan</p>
      <ReconnectingLine on={reconnecting} />
    </div>
  );
}

// ── 2. The split ─────────────────────────────────────────────────────────────

function Chip({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 transition",
        on ? "border-foreground bg-muted/60 border-2" : "border-border hover:bg-muted/60",
      )}
    >
      <span className="text-base font-semibold">{title}</span>
      <span className="text-muted-foreground text-sm tabular-nums">{sub}</span>
    </button>
  );
}

function SplitScreen({
  tab,
  getSupabase,
  reconnecting,
  onTapped,
  onCancel,
  busyCancel,
}: {
  tab: GuestTab;
  getSupabase: () => Parameters<typeof apiPayTab>[0];
  reconnecting: boolean;
  onTapped: () => void;
  onCancel: () => void;
  busyCancel: boolean;
}) {
  const bill = tab.bill_cents ?? 0;
  const suggested = tab.tip_suggested_cents;
  const [tipChoice, setTipChoice] = useState<TipChoice>(suggested > 0 ? "waiter" : "none");
  const [tipText, setTipText] = useState("");
  const [useCredit, setUseCredit] = useState(tab.spendable_cents > 0);
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const m = (c: number) => money(c, tab.currency);

  const typedTip = tipChoice === "other" ? readAmount(tipText) : null;
  const tipBad = tipChoice === "other" && tipText.trim() !== "" && typedTip === null;
  const tip = tipChoice === "waiter"
    ? suggested
    : typeof tipChoice === "number"
    ? Math.round((bill * tipChoice) / 100)
    : tipChoice === "other"
    ? typedTip ?? 0
    : 0;
  const split = tabSplit({
    billCents: bill,
    tipCents: tip,
    spendableCents: tab.spendable_cents,
    useCredit,
    cashBackBps: tab.rates.cash_back_bps,
  });
  const canPay = bill > 0 && !tipBad && !(tipChoice === "other" && tipText.trim() === "") && !busy;

  async function pay() {
    if (!canPay) return;
    // One request id per split: a retry after a lost answer replays the
    // same tap, a changed split is a new one.
    const key = `${tab.bill_version}|${split.credit_cents}|${split.cash_bill_cents}|${split.cash_tip_cents}`;
    if (!attempt.current || attempt.current.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    try {
      await apiPayTab(getSupabase(), {
        tab_id: tab.tab_id,
        bill_version: tab.bill_version,
        request_id: attempt.current.id,
        credit_cents: split.credit_cents,
        cash_bill_cents: split.cash_bill_cents,
        cash_tip_cents: split.cash_tip_cents,
      });
      attempt.current = null;
      onTapped();
    } catch (e) {
      if (!(e instanceof EFError) || !e.code) {
        // No verdict: keep the id, so the next tap replays instead of paying twice.
        toast(NETWORK_FAILURE, { tone: "error" });
        return;
      }
      attempt.current = null;
      toast(TAB_REFUSAL[e.code] ?? e.message, { tone: "error" });
      onTapped();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col" data-pay-tab-split>
      <div className="border-border bg-card flex flex-col items-center rounded-2xl border px-4 py-5 text-center">
        <p className="text-base font-semibold">{tab.place.name ?? "A Mesita place"}</p>
        <p className="font-display mt-2 text-4xl font-semibold tabular-nums" data-tab-total>
          {m(split.total_cents)}
        </p>
        <p className="text-muted-foreground mt-1 text-sm tabular-nums">
          {m(bill)} bill{tip > 0 ? ` + ${m(tip)} tip` : ""}
          {tab.ticket ? ` · Ticket ${tab.ticket}` : ""}
        </p>
        <ReconnectingLine on={reconnecting} />
      </div>

      <h2 className="mt-6 px-1 text-base font-semibold">Tip</h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {suggested > 0 ? (
          <Chip on={tipChoice === "waiter"} onClick={() => setTipChoice("waiter")} title="Waiter's" sub={m(suggested)} />
        ) : null}
        {TIP_PERCENTS.map((pct) => (
          <Chip key={pct} on={tipChoice === pct} onClick={() => setTipChoice(pct)} title={`${pct}%`} sub={m(Math.round((bill * pct) / 100))} />
        ))}
        <Chip on={tipChoice === "other"} onClick={() => setTipChoice("other")} title="Other" sub="Type it" />
        <Chip on={tipChoice === "none"} onClick={() => setTipChoice("none")} title="No tip" sub={m(0)} />
      </div>
      {tipChoice === "other" ? (
        <input
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          placeholder="Tip"
          aria-label="Tip"
          value={tipText}
          onChange={(e) => setTipText(e.target.value)}
          className={cn(FIELD_CLASS, "mt-2 tabular-nums")}
        />
      ) : null}
      {tipBad ? <p className="text-muted-foreground mt-1 px-1 text-sm">Type a tip like 30 or 30.50</p> : null}

      <h2 className="mt-6 px-1 text-base font-semibold">Pay the bill</h2>
      <div className="border-border bg-card mt-2 overflow-hidden rounded-2xl border">
        {tab.spendable_cents > 0 ? (
          <>
            <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-3">
              <span className="text-base font-semibold">Use my {m(tab.spendable_cents)} credit here</span>
              <input
                type="checkbox"
                role="switch"
                checked={useCredit}
                onChange={(e) => setUseCredit(e.target.checked)}
                className="accent-foreground h-6 w-6 shrink-0"
              />
            </label>
            <div className="bg-border h-px" />
          </>
        ) : null}
        <p className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-base">
          <span>{split.cash_bill_cents > 0 ? (split.credit_cents > 0 ? "The rest in cash" : "In cash") : "Your credit pays all of it"}</span>
          <span className="font-semibold tabular-nums">{split.cash_bill_cents > 0 ? m(split.cash_bill_cents) : m(split.credit_cents)}</span>
        </p>
      </div>

      {tip > 0 ? (
        <>
          <h2 className="mt-6 px-1 text-base font-semibold">Pay the tip</h2>
          <div className="border-border bg-card mt-2 rounded-2xl border px-4 py-3">
            <p className="flex min-h-8 items-center justify-between text-base">
              <span>In cash</span>
              <span className="font-semibold tabular-nums">{m(tip)}</span>
            </p>
            <p className="text-muted-foreground mt-0.5 text-sm">Tips can&apos;t be paid with credits.</p>
          </div>
        </>
      ) : null}

      <div className="bg-muted/60 mt-6 flex flex-col gap-2 rounded-2xl px-4 py-3.5 text-sm tabular-nums" data-pay-split>
        {split.credit_cents > 0 ? (
          <p className="flex justify-between"><span>Bill · credit</span><span>{m(split.credit_cents)}</span></p>
        ) : null}
        {split.cash_bill_cents > 0 ? (
          <p className="flex justify-between"><span>Bill · cash</span><span>{m(split.cash_bill_cents)}</span></p>
        ) : null}
        {split.cash_tip_cents > 0 ? (
          <p className="flex justify-between"><span>Tip · cash</span><span>{m(split.cash_tip_cents)}</span></p>
        ) : null}
        <div className="bg-border h-px" />
        <p className="flex justify-between text-base font-semibold"><span>Total</span><span>{m(split.total_cents)}</span></p>
        {split.cashback_cents > 0 ? (
          <p className="text-muted-foreground flex justify-between">
            <span>You get back as credit here</span>
            <span>{m(split.cashback_cents)}</span>
          </p>
        ) : null}
      </div>

      <Button size="lg" className="mt-6 w-full text-base font-semibold" disabled={!canPay} onClick={() => void pay()}>
        {busy ? <Spinner size="sm" label="Paying" /> : `Pay ${m(split.total_cents)}`}
      </Button>
      {split.cash_due_cents > 0 ? (
        <p className="text-muted-foreground mt-2 text-center text-sm tabular-nums">
          You give the waiter {m(split.cash_due_cents)} in cash
        </p>
      ) : null}
      <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} disabled={busyCancel || busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

// ── 3. The cash ──────────────────────────────────────────────────────────────

function CashScreen({ tab, reconnecting, busy, onChange }: { tab: GuestTab; reconnecting: boolean; busy: boolean; onChange: () => void }) {
  const m = (c: number) => money(c, tab.currency);
  return (
    <div className="flex flex-col" data-pay-tab-cash>
      <div className="border-border bg-card flex flex-col items-center rounded-2xl border px-4 py-6 text-center">
        <p className="text-base font-semibold">{tab.place.name ?? "A Mesita place"}</p>
        <p className="text-muted-foreground mt-3 text-base">Give the waiter</p>
        <p className="font-display mt-1 text-4xl font-semibold tabular-nums" data-tab-cash-due>
          {m(tab.cash_due_cents)}
        </p>
        <p className="text-muted-foreground mt-1 text-base">in cash</p>
        <p className="mt-5 flex items-center gap-2 text-base font-semibold" role="status" aria-live="polite">
          <Dot />
          Waiting for the waiter to tap Received
        </p>
        <ReconnectingLine on={reconnecting} />
      </div>
      <div className="bg-muted/60 mt-4 flex flex-col gap-2 rounded-2xl px-4 py-3.5 text-sm tabular-nums">
        {tab.credit_cents > 0 ? (
          <p className="flex justify-between"><span>Bill · credit</span><span>{m(tab.credit_cents)}</span></p>
        ) : null}
        {tab.cash_bill_cents > 0 ? (
          <p className="flex justify-between"><span>Bill · cash</span><span>{m(tab.cash_bill_cents)}</span></p>
        ) : null}
        {tab.cash_tip_cents > 0 ? (
          <p className="flex justify-between"><span>Tip · cash</span><span>{m(tab.cash_tip_cents)}</span></p>
        ) : null}
        {tab.credit_cents > 0 ? (
          <p className="text-muted-foreground">Your credit is taken when the waiter taps Received.</p>
        ) : null}
      </div>
      <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-6")} disabled={busy} onClick={onChange}>
        Change how I pay
      </button>
    </div>
  );
}

// ── 4. Paid ──────────────────────────────────────────────────────────────────

function PaidScreen({ tab, onDone }: { tab: GuestTab; onDone: () => void }) {
  const m = (c: number) => money(c, tab.currency);
  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const total = tab.credit_cents + cash;
  const how = [tab.credit_cents > 0 ? `${m(tab.credit_cents)} credit` : null, cash > 0 ? `${m(cash)} cash` : null].filter(Boolean).join(" · ");
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-green-700 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-white"
      role="status"
      data-pay-tab-paid
    >
      {tab.test_mode ? <p className="mb-4 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{TEST_BAND_TEXT}</p> : null}
      <CheckCircle2 className="h-24 w-24" aria-hidden strokeWidth={1.75} />
      <p className="mt-4 text-base font-semibold">{tab.paid_at ? `Paid · ${clockTime(tab.paid_at)}` : "Paid"}</p>
      <p className="font-display mt-2 text-4xl font-semibold tabular-nums">{m(total)}</p>
      {tab.cash_tip_cents > 0 ? (
        <p className="mt-1 text-sm text-white/80 tabular-nums">
          {m(total - tab.cash_tip_cents)} + {m(tab.cash_tip_cents)} tip
        </p>
      ) : null}
      {how ? <p className="mt-0.5 text-sm text-white/80 tabular-nums">{how}</p> : null}
      <p className="mt-4 text-base font-semibold">{tab.place.name ?? "A Mesita place"}</p>
      {tab.cashback_cents > 0 ? (
        <p className="mt-1 text-base">You get {m(tab.cashback_cents)} back as credit here</p>
      ) : null}
      {tab.ticket ? <p className="mt-1 text-sm text-white/80">Ticket {tab.ticket}</p> : null}
      <LiveClock />
      <button
        type="button"
        onClick={onDone}
        className="mt-8 min-h-12 w-full rounded-2xl bg-white px-4 text-base font-semibold text-green-800 transition hover:bg-white/90"
      >
        Done
      </button>
    </div>
  );
}
