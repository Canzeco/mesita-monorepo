"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TEST_BAND_TEXT, TestBand } from "@mesita/place-profile";
import { clockTime, readAmount } from "@mesita/place-profile/lib/money";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiAddCard, brandLabel, CARD_REFUSAL } from "@/lib/api/cards";
import {
  apiCancelTab,
  apiGetTab,
  apiOpenTab,
  apiPayTab,
  runBankCheck,
  TAB_REFUSAL,
  tabSplit,
  type GuestTab,
  type PayWith,
  type TabCard,
  type TabCardStep,
  type TabRead,
} from "@/lib/api/tab";
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
// coming back. Two failed reads in a row say "Reconnecting…"; four, while
// nothing is paid yet, offer "Pay the usual way" (the waiter's code door).
//
// Cards (MESITA-3572; the card part is MESITA-3563): when get-tab says the
// place takes cards, the rest of the bill and the tip can each go on a saved
// card (5% back on the card bill part, never the tip). The card is charged
// inside the app; a bank check (3-D Secure) runs in Stripe.js, loaded only
// then. No saved card: "Add a card" opens Stripe's page and comes back here.

const FAST_MS = 1_500;
const MID_MS = 5_000;
const SLOW_MS = 10_000;
const FINAL = new Set(["paid", "expired", "cancelled"]);
/** Failed reads before "Pay the usual way" shows. */
const USUAL_WAY_AFTER = 4;
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
  // Saved cards: asked once (with_cards) until an answer lists them.
  const [cards, setCards] = useState<TabCard[] | null>(null);
  const cardsAsked = useRef(false);
  const [cardAction, setCardAction] = useState<TabCardStep | null>(null);
  const [checking, setChecking] = useState(false);

  /** Applies one read of the tab: the tab, the cards, a card part's step. */
  function take(r: TabRead) {
    setTab(r.tab);
    if (r.cards) {
      cardsAsked.current = true;
      setCards(r.cards);
    }
    setCardAction(r.card_action ?? null);
    if (r.card_error) toast(TAB_REFUSAL[r.card_error.code] ?? r.card_error.error, { tone: "error" });
  }
  const withCards = () => ({ withCards: !cardsAsked.current });

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
      void apiGetTab(getSupabase(), start.tabId, withCards())
        .then((r) => {
          if (cancelled) return;
          take(r);
          if (r.tab.status === "waiting_bill") void open(r.tab.place.id);
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
      apiGetTab(getSupabase(), tabId, withCards())
        .then((r) => {
          if (cancelled) return;
          const key = `${r.tab.status}|${r.tab.updated_at}`;
          if (key !== lastChange.current.key) lastChange.current = { at: Date.now(), key };
          setFailures(0);
          take(r);
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

  /** A card part asked for a bank check: Stripe.js runs it on the place's
   *  account; the poll then reads whether it went through. */
  async function bankCheck(step: TabCardStep) {
    setChecking(true);
    try {
      if ((await runBankCheck(step)) === "unavailable") {
        toast("Couldn't open the bank check. Try again.", { tone: "error" });
      }
    } finally {
      setChecking(false);
      readNow();
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
  const tabPlaceId = tab?.place.id ?? (start.kind === "place" ? start.placeId : null);
  // Mesita isn't answering and nothing is paid yet: the waiter's code door.
  const usualWay =
    failures >= USUAL_WAY_AFTER && tabPlaceId && canUseCode(tabPlaceId) && (status === "waiting_bill" || status === "billed") ? (
      <div className="border-border bg-card mt-4 rounded-2xl border px-4 py-4" role="status">
        <p className="text-base font-semibold">Mesita isn&apos;t answering</p>
        <p className="text-muted-foreground mt-1 text-sm">Nothing was paid. You can pay with the waiter&apos;s code instead.</p>
        <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} onClick={() => void payWithCode(tabPlaceId)}>
          Pay the usual way
        </button>
      </div>
    ) : null;

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
        {usualWay}
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
          cards={cards}
          getSupabase={getSupabase}
          reconnecting={reconnecting}
          onTapped={readNow}
          onCardStep={(step) => void bankCheck(step)}
          onCancel={() => void cancel("cancel")}
          busyCancel={busy}
        />
        {usualWay}
      </Shell>
    );
  }

  if (tab.status === "paying") {
    const cardGoing = tab.parts.some((p) => p.part === "card" && (p.status === "opening" || p.status === "open"));
    return (
      <Shell onBack={onDone} testMode={tab.test_mode}>
        {cardGoing || checking ? (
          <CardScreen
            tab={tab}
            reconnecting={reconnecting}
            checking={checking}
            action={cardAction?.status === "requires_action" ? cardAction : null}
            onFinishCheck={(step) => void bankCheck(step)}
          />
        ) : (
          <CashScreen tab={tab} reconnecting={reconnecting} busy={busy} onChange={() => void cancel("change")} />
        )}
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

function Chip({
  on,
  onClick,
  title,
  sub,
  disabled = false,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 transition disabled:opacity-40",
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
  cards,
  getSupabase,
  reconnecting,
  onTapped,
  onCardStep,
  onCancel,
  busyCancel,
}: {
  tab: GuestTab;
  /** The guest's saved cards; null until the first read lists them. */
  cards: TabCard[] | null;
  getSupabase: () => Parameters<typeof apiPayTab>[0];
  reconnecting: boolean;
  onTapped: () => void;
  onCardStep: (step: TabCardStep) => void;
  onCancel: () => void;
  busyCancel: boolean;
}) {
  const bill = tab.bill_cents ?? 0;
  const suggested = tab.tip_suggested_cents;
  const cardOn = tab.rates.card_available;
  const [tipChoice, setTipChoice] = useState<TipChoice>(suggested > 0 ? "waiter" : "none");
  const [tipText, setTipText] = useState("");
  const [useCredit, setUseCredit] = useState(tab.spendable_cents > 0);
  const [billWith, setBillWith] = useState<PayWith>("cash");
  const [tipWithPick, setTipWithPick] = useState<PayWith>("cash");
  const [pmPick, setPmPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
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
  const credit = useCredit ? Math.min(Math.max(0, tab.spendable_cents), bill) : 0;
  const rest = bill - credit;
  const effBillWith: PayWith = cardOn && rest > 0 ? billWith : "cash";
  // A card tip needs part of the bill by card or credit (card_tip_alone).
  const tipCardOk = cardOn && (effBillWith === "card" || credit > 0);
  const tipWith: PayWith = tipCardOk ? tipWithPick : "cash";
  const split = tabSplit({
    billCents: bill,
    tipCents: tip,
    spendableCents: tab.spendable_cents,
    useCredit,
    cashBackBps: tab.rates.cash_back_bps,
    cardBackBps: tab.rates.card_back_bps,
    billWith: effBillWith,
    tipWith,
  });
  const usesCard = split.card_due_cents > 0;
  const card = usesCard && cards && cards.length > 0 ? cards.find((c) => c.id === pmPick) ?? cards[0] : null;
  const belowMinimum = usesCard && split.card_due_cents < tab.rates.card_minimum_cents;
  const canPay =
    bill > 0 &&
    !tipBad &&
    !(tipChoice === "other" && tipText.trim() === "") &&
    !busy &&
    (!usesCard || (card !== null && !belowMinimum));

  async function pay() {
    if (!canPay) return;
    // One request id per split: a retry after a lost answer replays the
    // same tap (never a second charge), a changed split is a new one.
    const key = [tab.bill_version, split.credit_cents, split.cash_bill_cents, split.cash_tip_cents, split.card_bill_cents, split.card_tip_cents, card?.id ?? ""].join("|");
    if (!attempt.current || attempt.current.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    try {
      const r = await apiPayTab(getSupabase(), {
        tab_id: tab.tab_id,
        bill_version: tab.bill_version,
        request_id: attempt.current.id,
        credit_cents: split.credit_cents,
        cash_bill_cents: split.cash_bill_cents,
        cash_tip_cents: split.cash_tip_cents,
        card_bill_cents: split.card_bill_cents,
        card_tip_cents: split.card_tip_cents,
        card_pm_id: card?.id ?? null,
      });
      attempt.current = null;
      if (r.card?.status === "requires_action") onCardStep(r.card);
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

  /** No saved card: Stripe's page saves one and comes back to this bill. */
  async function addCard() {
    setAdding(true);
    try {
      const back = `${window.location.origin}${window.location.pathname}?tab=${encodeURIComponent(tab.tab_id)}`;
      const { url } = await apiAddCard(getSupabase(), back);
      window.location.assign(url);
    } catch (e) {
      toast(e instanceof EFError && e.code ? (CARD_REFUSAL[e.code] ?? e.message) : NETWORK_FAILURE, { tone: "error" });
      setAdding(false);
    }
  }

  const cardSub = cards === null ? "…" : cards.length === 0 ? "Add one" : `•••• ${(card ?? cards[0]).last4}`;
  const backBps = (bps: number) => (bps > 0 ? ` · ${bps / 100}% back` : "");

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
        {rest > 0 && cardOn ? (
          <div className="px-4 py-3">
            <p className="flex items-center justify-between gap-3 text-base">
              <span>{credit > 0 ? "The rest" : "All of it"}</span>
              <span className="font-semibold tabular-nums">{m(rest)}</span>
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Chip on={effBillWith === "cash"} onClick={() => setBillWith("cash")} title="Cash" sub={`To the waiter${backBps(tab.rates.cash_back_bps)}`} />
              <Chip on={effBillWith === "card"} onClick={() => setBillWith("card")} title="Card" sub={`${cardSub}${backBps(tab.rates.card_back_bps)}`} />
            </div>
          </div>
        ) : (
          <p className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-base">
            <span>{rest > 0 ? (credit > 0 ? "The rest in cash" : "In cash") : "Your credit pays all of it"}</span>
            <span className="font-semibold tabular-nums">{rest > 0 ? m(rest) : m(credit)}</span>
          </p>
        )}
      </div>

      {tip > 0 ? (
        <>
          <h2 className="mt-6 px-1 text-base font-semibold">Pay the tip</h2>
          <div className="border-border bg-card mt-2 rounded-2xl border px-4 py-3">
            {cardOn ? (
              <>
                <p className="flex items-center justify-between gap-3 text-base">
                  <span>Tip</span>
                  <span className="font-semibold tabular-nums">{m(tip)}</span>
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Chip on={tipWith === "cash"} onClick={() => setTipWithPick("cash")} title="Cash" sub="To the waiter" />
                  <Chip on={tipWith === "card"} onClick={() => setTipWithPick("card")} title="Card" sub={cardSub} disabled={!tipCardOk} />
                </div>
                {!tipCardOk ? (
                  <p className="text-muted-foreground mt-2 text-sm">A tip by card needs part of the bill by card or credit.</p>
                ) : null}
              </>
            ) : (
              <p className="flex min-h-8 items-center justify-between text-base">
                <span>In cash</span>
                <span className="font-semibold tabular-nums">{m(tip)}</span>
              </p>
            )}
            <p className="text-muted-foreground mt-1 text-sm">Tips can&apos;t be paid with credits.</p>
          </div>
        </>
      ) : null}

      {usesCard ? (
        <>
          <h2 className="mt-6 px-1 text-base font-semibold">Card</h2>
          {cards === null ? (
            <div className="border-border bg-card mt-2 flex min-h-14 items-center rounded-2xl border px-4 py-3">
              <Spinner size="sm" label="Loading your cards" />
            </div>
          ) : cards.length === 0 ? (
            <div className="border-border bg-card mt-2 rounded-2xl border px-4 py-3">
              <p className="text-base">You have no saved card.</p>
              <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} disabled={adding} onClick={() => void addCard()}>
                {adding ? <Spinner size="sm" label="Opening" /> : "Add a card"}
              </button>
            </div>
          ) : (
            <div className="border-border bg-card mt-2 overflow-hidden rounded-2xl border" role="radiogroup" aria-label="Card">
              {cards.map((c, i) => (
                <Fragment key={c.id}>
                  {i > 0 && <div className="bg-border h-px" />}
                  <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-3">
                    <span className="text-base">
                      <span className="font-semibold">{brandLabel(c.brand)}</span> •••• {c.last4}
                    </span>
                    <input
                      type="radio"
                      name="tab-card"
                      checked={card?.id === c.id}
                      onChange={() => setPmPick(c.id)}
                      className="accent-foreground h-5 w-5 shrink-0"
                    />
                  </label>
                </Fragment>
              ))}
              <div className="bg-border h-px" />
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex min-h-12 w-full items-center px-4 text-sm font-semibold"
                disabled={adding}
                onClick={() => void addCard()}
              >
                Add another card
              </button>
            </div>
          )}
          {belowMinimum ? (
            <p className="text-muted-foreground mt-2 px-1 text-sm tabular-nums">
              A card needs at least {m(tab.rates.card_minimum_cents)}. Pay this part another way.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="bg-muted/60 mt-6 flex flex-col gap-2 rounded-2xl px-4 py-3.5 text-sm tabular-nums" data-pay-split>
        {split.credit_cents > 0 ? (
          <p className="flex justify-between"><span>Bill · credit</span><span>{m(split.credit_cents)}</span></p>
        ) : null}
        {split.card_bill_cents > 0 ? (
          <p className="flex justify-between"><span>Bill · card</span><span>{m(split.card_bill_cents)}</span></p>
        ) : null}
        {split.cash_bill_cents > 0 ? (
          <p className="flex justify-between"><span>Bill · cash</span><span>{m(split.cash_bill_cents)}</span></p>
        ) : null}
        {split.card_tip_cents > 0 ? (
          <p className="flex justify-between"><span>Tip · card</span><span>{m(split.card_tip_cents)}</span></p>
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
      {card && usesCard ? (
        <p className="text-muted-foreground mt-2 text-center text-sm tabular-nums">
          {m(split.card_due_cents)} on your {brandLabel(card.brand)} •••• {card.last4}
        </p>
      ) : null}
      {split.cash_due_cents > 0 ? (
        <p className="text-muted-foreground mt-1 text-center text-sm tabular-nums">
          You give the waiter {m(split.cash_due_cents)} in cash
        </p>
      ) : null}
      <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} disabled={busyCancel || busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

// ── 3. The card ──────────────────────────────────────────────────────────────

function CardScreen({
  tab,
  reconnecting,
  checking,
  action,
  onFinishCheck,
}: {
  tab: GuestTab;
  reconnecting: boolean;
  checking: boolean;
  action: TabCardStep | null;
  onFinishCheck: (step: TabCardStep) => void;
}) {
  const m = (c: number) => money(c, tab.currency);
  return (
    <div className="flex flex-col" data-pay-tab-card>
      <div className="border-border bg-card flex flex-col items-center rounded-2xl border px-4 py-6 text-center">
        <p className="text-base font-semibold">{tab.place.name ?? "A Mesita place"}</p>
        <p className="font-display mt-3 text-4xl font-semibold tabular-nums">{m(tab.card_bill_cents + tab.card_tip_cents)}</p>
        <p className="text-muted-foreground mt-1 text-base">on your card</p>
        <p className="mt-5 flex items-center gap-2 text-base font-semibold" role="status" aria-live="polite">
          <Dot />
          {checking ? "Checking with your bank" : action ? "Your bank wants to check this payment" : "Your card is going through"}
        </p>
        <ReconnectingLine on={reconnecting} />
      </div>
      {action && !checking ? (
        <Button size="lg" className="mt-6 w-full text-base font-semibold" onClick={() => onFinishCheck(action)}>
          Finish the bank check
        </Button>
      ) : null}
      {tab.cash_due_cents > 0 ? (
        <p className="text-muted-foreground mt-4 text-center text-sm tabular-nums">
          Then you give the waiter {m(tab.cash_due_cents)} in cash
        </p>
      ) : null}
    </div>
  );
}

// ── 4. The cash ──────────────────────────────────────────────────────────────

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
        {tab.card_bill_cents > 0 ? (
          <p className="flex justify-between"><span>Bill · card (paid)</span><span>{m(tab.card_bill_cents)}</span></p>
        ) : null}
        {tab.cash_bill_cents > 0 ? (
          <p className="flex justify-between"><span>Bill · cash</span><span>{m(tab.cash_bill_cents)}</span></p>
        ) : null}
        {tab.card_tip_cents > 0 ? (
          <p className="flex justify-between"><span>Tip · card (paid)</span><span>{m(tab.card_tip_cents)}</span></p>
        ) : null}
        {tab.cash_tip_cents > 0 ? (
          <p className="flex justify-between"><span>Tip · cash</span><span>{m(tab.cash_tip_cents)}</span></p>
        ) : null}
        {tab.credit_cents > 0 && tab.card_bill_cents + tab.card_tip_cents === 0 ? (
          <p className="text-muted-foreground">Your credit is taken when the waiter taps Received.</p>
        ) : null}
      </div>
      <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-6")} disabled={busy} onClick={onChange}>
        Change how I pay
      </button>
    </div>
  );
}

// ── 5. Paid ──────────────────────────────────────────────────────────────────

function PaidScreen({ tab, onDone }: { tab: GuestTab; onDone: () => void }) {
  const m = (c: number) => money(c, tab.currency);
  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const card = tab.card_bill_cents + tab.card_tip_cents;
  const tip = tab.cash_tip_cents + tab.card_tip_cents;
  const total = tab.credit_cents + cash + card;
  const how = [
    tab.credit_cents > 0 ? `${m(tab.credit_cents)} credit` : null,
    card > 0 ? `${m(card)} card` : null,
    cash > 0 ? `${m(cash)} cash` : null,
  ].filter(Boolean).join(" · ");
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
      {tip > 0 ? (
        <p className="mt-1 text-sm text-white/80 tabular-nums">
          {m(total - tip)} + {m(tip)} tip
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
