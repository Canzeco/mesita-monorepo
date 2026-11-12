"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, CheckCircle2, ChevronRight, CreditCard, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiAddCard, brandLabel, CARD_REFUSAL } from "@/lib/api/cards";
import {
  apiCancelTab,
  apiGetTab,
  apiJoinTab,
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
import { payTabPath } from "@/lib/consumer-route-contract";
import { toast } from "@/lib/toast";
import { type PadKey, pressKey, readTip } from "@/lib/pay-keypad";
import { cn } from "@/lib/utils";
import { AmountDisplay, AmountKeypad } from "./AmountKeypad";
import { GuestTabView } from "./GuestTabView";
import { LiveClock } from "./LiveClock";
import { ShareCard, SplitButton } from "./SplitWithFriends";
import { NETWORK_FAILURE, QUIET_BUTTON_CLASS } from "./pay-common";

// PAY AT THE TABLE, THE GUEST'S SCREENS (MESITA-3564; the backend is
// MESITA-3567/3568/3562, Docs › Credits "Pay at the table").
//
// 1. "Show this to the waiter": a big QR of the waiter's link
//    (consumer-web-open-tab), "Waiting for the bill". The waiter scans it on
//    visit.mesita.ai and types the bill and a tip suggestion.
// 2. Billed: one screen. The tip (the waiter's suggestion picked, 10/15/20%,
//    Other; no tip is Other with 0 typed, MESITA-3748: the guest decides), how the bill is paid (the guest's
//    credit here first, on by default, the rest in cash) and how the tip is
//    paid (cash; credits never pay a tip), what comes back (2% of the cash
//    bill part, never the tip) and one button "Pay $total".
// 3. A cash part: "Give the waiter $C in cash" until the waiter taps
//    Received; "Change how I pay" undoes it before then.
// 4. Paid: full screen green-700, the amount, the time, the place, the
//    cashback and a live clock.
//
// ONE SCREEN A STATE (MESITA-3742, after MESITA-3739 did the guest's own
// flow): white, no tab bar, nothing scrolls. The QR takes the height left
// (a size container, 140–240px); the billed screen is three steps (Tip →
// How you pay → Review) with the place and total on top and the button
// pinned; a split table is one line that opens its card in a sheet.
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
//
// Friends (MESITA-3695, SplitWithFriends.tsx): a billed whole bill offers
// "Split with friends"; splitting opens the guest's own share, an ordinary
// bill this screen pays as above, under one card with the table (paid, left,
// the friends' QR). A split table read here switches to the guest's share;
// /pay/join/<token> (a friend's scan) takes a share and switches to it.

const FAST_MS = 1_500;
const MID_MS = 5_000;
const SLOW_MS = 10_000;
const FINAL = new Set(["paid", "expired", "cancelled"]);
/** Failed reads before "Pay the usual way" shows. */
const USUAL_WAY_AFTER = 4;
const TIP_PERCENTS = [10, 15, 20] as const;
type TipChoice = "waiter" | (typeof TIP_PERCENTS)[number] | "other" | null;


export type TabStart =
  | { kind: "place"; placeId: string }
  | { kind: "tab"; tabId: string }
  | { kind: "join"; joinToken: string };

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
  onPayAgain,
  onEnded,
  registerBack,
}: {
  start: TabStart;
  getSupabase: () => Parameters<typeof apiGetTab>[0];
  /** Whether the waiter's 4-digit code (MESITA-3306) can pay at this place. */
  canUseCode: (placeId: string) => boolean;
  /** MESITA-3709: a guest tab ends back on the form at its place. */
  onPayAgain?: (placeId: string) => void;
  /** MESITA-3772: the guest cancelled or closed their own payment. */
  onEnded?: () => void;
  /** The tab's id, for its address /pay/tab/<id> (a reload shows the same tab). */
  onTabId: (tabId: string) => void;
  onWaiterCode: (placeId: string) => void;
  onDone: () => void;
  /** The header's back arrow asks this first (the billed steps step back). */
  registerBack?: (back: (() => boolean) | null) => void;
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
  // The friends' QR (MESITA-3695): shown only on the device that split.
  const [joinToken, setJoinToken] = useState<string | null>(null);

  /** Moves the screen to another bill: the guest's share, or back to the
   *  table when splitting stops. */
  function switchTo(id: string) {
    setTab(null);
    setTabId(id);
    onTabId(id);
    lastChange.current = { at: Date.now(), key: "" };
  }

  /** Applies one read of the tab: the tab, the cards, a card part's step. */
  function take(r: TabRead) {
    // A split table: the guest pays their own share.
    if (r.tab.my_share_tab_id && r.tab.my_share_tab_id !== r.tab.tab_id) {
      switchTo(r.tab.my_share_tab_id);
      return;
    }
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

  // Boot: a picked place opens its tab; a reloaded /pay/tab/<id> reads it and,
  // while it still waits for the bill, opens again for a fresh QR (the QR's
  // secret is never stored on the device).
  useEffect(() => {
    let cancelled = false;
    if (start.kind === "place") {
      void open(start.placeId);
    } else if (start.kind === "join") {
      void apiJoinTab(getSupabase(), start.joinToken)
        .then((j) => {
          if (!cancelled) switchTo(j.share_tab_id);
        })
        .catch((e) => {
          if (cancelled) return;
          if (e instanceof EFError && e.code && e.code !== "not_found") {
            toast(TAB_REFUSAL[e.code] ?? e.message, { tone: "error" });
          }
          if (e instanceof EFError && e.status !== null && e.status < 500) setGone(true);
          else setOpenFailed(true);
        });
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
      <div className="border-border mt-3 flex shrink-0 items-center justify-between gap-3 rounded-2xl border px-4 py-2" role="status">
        <p className="min-w-0 text-sm">
          <span className="font-semibold">Mesita isn&apos;t answering.</span> Nothing was paid.
        </p>
        <button type="button" className="min-h-11 shrink-0 text-sm font-semibold underline" onClick={() => void payWithCode(tabPlaceId)}>
          Pay the usual way
        </button>
      </div>
    ) : null;

  if (gone) {
    return (
      <Shell>
        <p className="border-border bg-card rounded-2xl border px-4 py-4 text-base font-semibold" role="status">
          This bill isn&apos;t on your account
        </p>
        <Button size="lg" className="mt-auto w-full text-base font-semibold" onClick={onDone}>
          Done
        </Button>
      </Shell>
    );
  }

  if (openFailed && !tab) {
    return (
      <Shell>
        <p className="border-border bg-card rounded-2xl border px-4 py-4 text-base font-semibold" role="status">
          Couldn&apos;t open your bill. Check your connection.
        </p>
        <Button
          size="lg"
          className="mt-auto w-full text-base font-semibold"
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

  // MESITA-3709: the guest's own payment has its own checklist screen.
  if (tab && tab.origin === "guest") {
    return (
      <GuestTabView
        tab={tab}
        getSupabase={getSupabase}
        onPayAgain={(placeId) => (onPayAgain ? onPayAgain(placeId) : onDone())}
        onDone={onDone}
        onEnded={onEnded ?? onDone}
        registerBack={registerBack}
      />
    );
  }

  if (status === "waiting_bill") {
    const placeId = tab?.place.id ?? (start.kind === "place" ? start.placeId : null);
    return (
      <Shell testMode={tab?.test_mode ?? false}>
        <QrScreen
          qr={qr}
          placeName={tab?.place.name ?? null}
          expiresAt={tab?.expires_at ?? null}
          reconnecting={reconnecting}
        />
        {usualWay ?? (placeId && canUseCode(placeId) ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mx-auto flex min-h-11 shrink-0 items-center text-sm font-semibold underline"
            onClick={() => void payWithCode(placeId)}
            data-charge-code-link
          >
            Waiter gave you a code?
          </button>
        ) : null)}
        <button type="button" className={cn(QUIET_BUTTON_CLASS, "text-muted-foreground mt-2 shrink-0")} disabled={busy || !tabId} onClick={() => void cancel("cancel")}>
          Cancel
        </button>
      </Shell>
    );
  }

  if (!tab) {
    return (
      <Shell>
        <div className="flex min-h-0 flex-1 flex-col items-center" aria-busy>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-8 w-56" />
          <Skeleton className="mt-4 h-40 w-40 rounded-xl" />
          <Skeleton className="mt-4 h-4 w-32" />
        </div>
      </Shell>
    );
  }

  const shareCard = tab.table ? (
    <ShareLine tab={tab}>
      <ShareCard
        tab={tab}
        joinToken={joinToken}
        getSupabase={getSupabase}
        onJoinToken={setJoinToken}
        onWhole={(tableId) => {
          setJoinToken(null);
          switchTo(tableId);
        }}
        onChanged={readNow}
      />
    </ShareLine>
  ) : null;

  if (tab.status === "billed") {
    return (
      <Shell testMode={tab.test_mode}>
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
          registerBack={registerBack}
          friends={
            shareCard ?? (
              <SplitButton
                tab={tab}
                getSupabase={getSupabase}
                onSplit={(shareTabId, token) => {
                  setJoinToken(token);
                  switchTo(shareTabId);
                }}
              />
            )
          }
          usualWay={usualWay}
        />
      </Shell>
    );
  }

  if (tab.status === "paying") {
    const cardGoing = tab.parts.some((p) => p.part === "card" && (p.status === "opening" || p.status === "open"));
    return (
      <Shell testMode={tab.test_mode}>
        {shareCard}
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
    <Shell testMode={tab.test_mode}>
      <div className="border-border bg-card rounded-2xl border px-4 py-4" role="status">
        <p className="text-base font-semibold">{expired ? "This bill expired" : "This bill was cancelled"}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {expired ? `Nothing was paid at ${placeName}. A bill closes 30 minutes after it opens.` : `Nothing was paid at ${placeName}.`}
        </p>
      </div>
      <Button size="lg" className="mt-auto w-full text-base font-semibold" onClick={() => void reopen(tab.place.id)}>
        Open a new bill
      </Button>
      <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} onClick={onDone}>
        Done
      </button>
    </Shell>
  );
}

// Back lives in the screen's own header (Screen, MESITA-3647).
// The TEST band left every Pay screen (Pato, MESITA-3732: "remove the fucking
// test banner"); callers still pass testMode.
function Shell({ children }: { testMode?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-pay-tab>
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

// ── The fitted pieces (MESITA-3742) ──────────────────────────────────────────

/** The QR square: takes the height left, 140–240px (a size container; a
 *  plain 160px where container queries are missing). */
function FittedQr({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex min-h-0 w-full flex-1 items-center justify-center [container-type:size]">
      <div
        className="size-40 rounded-2xl bg-white p-2 ring-1 ring-black/10"
        style={{ width: "max(140px, min(100cqh, 100cqw, 240px))", height: "max(140px, min(100cqh, 100cqw, 240px))" }}
      >
        {children}
      </div>
    </div>
  );
}

/** A split table as one line; its card (shares, friends' QR) opens in a sheet. */
function ShareLine({ tab, children }: { tab: GuestTab; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const table = tab.table;
  if (!table) return null;
  return (
    <>
      <button
        type="button"
        className="border-border flex h-12 w-full shrink-0 items-center justify-between gap-3 rounded-2xl border px-4 text-left"
        onClick={() => setOpen(true)}
        data-share-line
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Users className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate text-sm">
            <span className="font-semibold">Split bill</span> ·{" "}
            {table.status === "paid" ? "All paid" : `${money(table.left_cents, tab.currency)} left`}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
          Friends&apos; QR
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      </button>
      <LocalSheet open={open} onClose={() => setOpen(false)} ariaLabel="Split bill">
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">{children}</div>
      </LocalSheet>
    </>
  );
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
    <div className="flex min-h-0 flex-1 flex-col items-center text-center" data-pay-tab-qr>
      {placeName ? <p className="w-full shrink-0 truncate text-base font-semibold">{placeName}</p> : null}
      <p className="font-display mt-1 shrink-0 text-2xl font-semibold">Show this to the waiter</p>
      <FittedQr>
        {qr ? (
          <QRCodeSVG value={qr} size={240} marginSize={0} style={{ width: "100%", height: "100%" }} aria-label="Your bill's QR for the waiter" data-tab-qr />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Spinner size="sm" label="Opening your bill" />
          </div>
        )}
      </FittedQr>
      <p className="mt-3 flex h-6 shrink-0 items-center gap-2 text-base font-semibold" role="status" aria-live="polite">
        <Dot />
        Waiting for the bill
        {minsLeft !== null && minsLeft <= 10 ? <span className="text-muted-foreground font-normal">· {minsLeft} min left</span> : null}
      </p>
      <p className="text-muted-foreground h-5 shrink-0 truncate text-sm">
        {reconnecting ? "Reconnecting…" : "Turn up your brightness if it doesn’t scan"}
      </p>
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
  compact = false,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  disabled?: boolean;
  /** 52px instead of 64px (How you pay, where four sit on one screen). */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 transition disabled:opacity-40",
        compact ? "h-13" : "h-16",
        on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
      )}
    >
      <span className="text-base font-semibold">{title}</span>
      <span className={cn("max-w-full truncate text-sm tabular-nums", on ? "opacity-80" : "text-muted-foreground")}>{sub}</span>
    </button>
  );
}

const SPLIT_STEPS = ["tip", "pay", "review"] as const;
type SplitStep = (typeof SPLIT_STEPS)[number];
const SPLIT_QUESTION: Record<SplitStep, string> = { tip: "Add a tip?", pay: "How do you pay?", review: "Review and pay" };

function SplitScreen({
  tab,
  cards,
  getSupabase,
  reconnecting,
  onTapped,
  onCardStep,
  onCancel,
  busyCancel,
  registerBack,
  friends,
  usualWay,
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
  registerBack?: (back: (() => boolean) | null) => void;
  /** The split table's line, or "Split with friends". */
  friends: React.ReactNode;
  /** "Mesita isn't answering · Pay the usual way", when it applies. */
  usualWay: React.ReactNode;
}) {
  const bill = tab.bill_cents ?? 0;
  const suggested = tab.tip_suggested_cents;
  const cardOn = tab.rates.card_available;
  const [step, setStep] = useState<SplitStep>("tip");
  const [tipChoice, setTipChoice] = useState<TipChoice>(suggested > 0 ? "waiter" : null);
  const [lastTip, setLastTip] = useState<TipChoice>(suggested > 0 ? "waiter" : null);
  const [tipText, setTipText] = useState("");
  const [useCredit, setUseCredit] = useState(tab.spendable_cents > 0);
  const [billWith, setBillWith] = useState<PayWith>("cash");
  const [tipWithPick, setTipWithPick] = useState<PayWith>("cash");
  const [pmPick, setPmPick] = useState<string | null>(null);
  const [cardSheet, setCardSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const m = (c: number) => money(c, tab.currency);

  const typedTip = tipChoice === "other" ? readTip(tipText) : null;
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
  const tipOk = tipChoice !== null && (tipChoice !== "other" || typedTip !== null);
  const payOk = !usesCard || (card !== null && !belowMinimum);
  const canPay = bill > 0 && tipOk && !busy && payOk;
  const stepIndex = SPLIT_STEPS.indexOf(step);
  const nextOk = step === "tip" ? tipOk : step === "pay" ? payOk : canPay;

  // The header's back arrow steps back through the steps; off the screen
  // from Tip. While a payment is going out it does nothing.
  useEffect(() => {
    if (!registerBack) return;
    registerBack(() => {
      if (busy || adding) return true;
      const i = SPLIT_STEPS.indexOf(step);
      if (i <= 0) return false;
      setStep(SPLIT_STEPS[i - 1]);
      return true;
    });
    return () => registerBack(null);
  }, [registerBack, step, busy, adding]);

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
      const back = `${window.location.origin}${payTabPath(tab.tab_id)}`;
      const { url } = await apiAddCard(getSupabase(), back);
      window.location.assign(url);
    } catch (e) {
      toast(e instanceof EFError && e.code ? (CARD_REFUSAL[e.code] ?? e.message) : NETWORK_FAILURE, { tone: "error" });
      setAdding(false);
    }
  }

  const cardSub = cards === null ? "…" : cards.length === 0 ? "Add one" : `•••• ${(card ?? cards[0]).last4}`;
  const backBps = (bps: number) => (bps > 0 ? ` · ${bps / 100}% back in credits` : "");
  const status = step === "pay" && belowMinimum
    ? `A card needs at least ${m(tab.rates.card_minimum_cents)}. Pay this part another way.`
    : step === "pay" && tip > 0 && cardOn && !tipCardOk
    ? "A tip by card needs part of the bill by card or credit."
    : reconnecting
    ? "Reconnecting…"
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-pay-tab-split={step}>
      <div className="flex h-9 shrink-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-base font-semibold">{tab.place.name ?? "A Mesita place"}</span>
        <span className="shrink-0 text-base font-semibold tabular-nums" data-tab-total>
          {m(split.total_cents)}
        </span>
      </div>
      <div className="flex h-5 shrink-0 items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground min-w-0 truncate tabular-nums">
          {m(bill)} bill{tip > 0 ? ` + ${m(tip)} tip` : ""}
          {tab.ticket ? ` · Ticket ${tab.ticket}` : ""}
        </span>
        <span className="text-muted-foreground shrink-0 tabular-nums">
          Step {stepIndex + 1} of {SPLIT_STEPS.length}
        </span>
      </div>
      <div className="mt-2 flex shrink-0 gap-1.5" aria-hidden>
        {SPLIT_STEPS.map((s, i) => (
          <span key={s} className={cn("h-1 flex-1 rounded-full", i <= stepIndex ? "bg-foreground" : "bg-border")} />
        ))}
      </div>

      <h2 className="mt-4 shrink-0 text-2xl font-semibold">{SPLIT_QUESTION[step]}</h2>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {step === "tip" && tipChoice !== "other" ? (
          <>
            <div className="grid shrink-0 grid-cols-3 gap-2">
              {suggested > 0 ? (
                <Chip on={tipChoice === "waiter"} onClick={() => { setTipChoice("waiter"); setLastTip("waiter"); }} title="Waiter's" sub={m(suggested)} />
              ) : null}
              {TIP_PERCENTS.map((pct) => (
                <Chip key={pct} on={tipChoice === pct} onClick={() => { setTipChoice(pct); setLastTip(pct); }} title={`${pct}%`} sub={m(Math.round((bill * pct) / 100))} />
              ))}
              <Chip on={false} onClick={() => setTipChoice("other")} title="Other" sub="Type it" />
            </div>
            <div className="mt-3 shrink-0">{friends}</div>
            {usualWay}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground mx-auto mt-auto flex min-h-11 shrink-0 items-center text-sm font-semibold underline"
              disabled={busyCancel || busy}
              onClick={onCancel}
            >
              Cancel this bill
            </button>
          </>
        ) : null}

        {step === "tip" && tipChoice === "other" ? (
          <>
            <div className="flex h-14 shrink-0 items-center justify-between gap-3">
              <AmountDisplay text={tipText} currency={tab.currency} label="Tip" />
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex min-h-11 shrink-0 items-center text-sm font-semibold underline"
                onClick={() => {
                  setTipText("");
                  setTipChoice(lastTip);
                }}
              >
                Back to %
              </button>
            </div>
            <div className="mt-2 flex min-h-0 flex-1 flex-col">
              <AmountKeypad text={tipText} onKey={(k: PadKey) => setTipText((t) => pressKey(t, k))} />
            </div>
          </>
        ) : null}

        {step === "pay" ? (
          <div className="flex shrink-0 flex-col gap-2.5">
            {tab.spendable_cents > 0 ? (
              <button
                type="button"
                role="switch"
                aria-checked={useCredit}
                onClick={() => setUseCredit((u) => !u)}
                className="border-border flex h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left"
              >
                <span className="min-w-0 truncate text-base">
                  {m(tab.spendable_cents)} credit · <span className="text-muted-foreground">{useCredit ? "applied" : "not used"}</span>
                </span>
                <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", useCredit ? "bg-foreground" : "bg-border")} aria-hidden>
                  <span className={cn("bg-card absolute top-0.5 h-5 w-5 rounded-full transition", useCredit ? "left-[1.125rem]" : "left-0.5")} />
                </span>
              </button>
            ) : null}
            {rest > 0 && cardOn ? (
              <div>
                <p className="flex h-5 items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{credit > 0 ? "The rest" : "The bill"}</span>
                  <span className="font-semibold tabular-nums">{m(rest)}</span>
                </p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Chip on={effBillWith === "cash"} onClick={() => setBillWith("cash")} title="Cash" sub={`To the waiter${backBps(tab.rates.cash_back_bps)}`} compact />
                  <Chip on={effBillWith === "card"} onClick={() => setBillWith("card")} title="Card" sub={`${cardSub}${backBps(tab.rates.card_back_bps)}`} compact />
                </div>
              </div>
            ) : (
              <p className="border-border flex h-12 items-center justify-between gap-3 rounded-2xl border px-4 text-base">
                <span>{rest > 0 ? (credit > 0 ? "The rest in cash" : "In cash") : "Your credit pays all of it"}</span>
                <span className="font-semibold tabular-nums">{rest > 0 ? m(rest) : m(credit)}</span>
              </p>
            )}
            {tip > 0 && cardOn ? (
              <div>
                <p className="flex h-5 items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">The tip · never credits</span>
                  <span className="font-semibold tabular-nums">{m(tip)}</span>
                </p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Chip on={tipWith === "cash"} onClick={() => setTipWithPick("cash")} title="Cash" sub="To the waiter" compact />
                  <Chip on={tipWith === "card"} onClick={() => setTipWithPick("card")} title="Card" sub={cardSub} disabled={!tipCardOk} compact />
                </div>
              </div>
            ) : null}
            {usesCard ? (
              cards === null ? (
                <div className="border-border flex h-12 items-center rounded-2xl border px-4">
                  <Spinner size="sm" label="Loading your cards" />
                </div>
              ) : cards.length === 0 ? (
                <button
                  type="button"
                  className="border-border flex h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left disabled:opacity-60"
                  disabled={adding}
                  onClick={() => void addCard()}
                >
                  <CreditCard className="h-5 w-5" aria-hidden />
                  <span className="text-base font-semibold">{adding ? "Opening…" : "Add a card"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="border-border flex h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left"
                  onClick={() => setCardSheet(true)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate text-base">
                      {card ? `${brandLabel(card.brand)} •••• ${card.last4}` : "Pick a card"}
                    </span>
                  </span>
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-sm font-semibold">
                    Change <ChevronRight className="h-4 w-4" aria-hidden />
                  </span>
                </button>
              )
            ) : null}
          </div>
        ) : null}

        {step === "review" ? (
          <>
            <div className="border-border flex shrink-0 flex-col rounded-2xl border px-4 py-3 text-base tabular-nums" data-pay-split>
              {split.credit_cents > 0 ? <SplitLine label="Bill · credit" value={m(split.credit_cents)} /> : null}
              {split.card_bill_cents > 0 ? <SplitLine label="Bill · card" value={m(split.card_bill_cents)} icon={<CreditCard />} /> : null}
              {split.cash_bill_cents > 0 ? <SplitLine label="Bill · cash" value={m(split.cash_bill_cents)} icon={<Banknote />} /> : null}
              {split.card_tip_cents > 0 ? <SplitLine label="Tip · card" value={m(split.card_tip_cents)} icon={<CreditCard />} /> : null}
              {split.cash_tip_cents > 0 ? <SplitLine label="Tip · cash" value={m(split.cash_tip_cents)} icon={<Banknote />} /> : null}
              <div className="border-border mt-1 flex h-8 items-center justify-between gap-3 border-t pt-1 text-lg font-semibold">
                <span>Total</span>
                <span>{m(split.total_cents)}</span>
              </div>
            </div>
            {split.cashback_cents > 0 ? (
              <p className="mt-2 shrink-0 truncate text-sm font-semibold text-green-700">You get {m(split.cashback_cents)} back as credit here</p>
            ) : null}
            {card && usesCard ? (
              <p className="text-muted-foreground mt-1 shrink-0 truncate text-sm tabular-nums">
                {m(split.card_due_cents)} on your {brandLabel(card.brand)} •••• {card.last4}
              </p>
            ) : null}
            {split.cash_due_cents > 0 ? (
              <p className="text-muted-foreground mt-1 shrink-0 truncate text-sm tabular-nums">You give the waiter {m(split.cash_due_cents)} in cash</p>
            ) : null}
          </>
        ) : null}

        <p className={cn("text-muted-foreground mt-auto line-clamp-2 shrink-0 pt-2 text-sm", !status && "hidden")} role="status">
          {status}
        </p>
      </div>

      <div className="shrink-0 pt-4">
        {step !== "review" ? (
          <Button
            size="lg"
            className="min-h-12 w-full text-base font-semibold"
            disabled={!nextOk}
            onClick={() => setStep(SPLIT_STEPS[stepIndex + 1])}
          >
            Next
          </Button>
        ) : (
          <Button size="lg" className="min-h-12 w-full text-base font-semibold" disabled={!canPay} onClick={() => void pay()}>
            {busy ? <Spinner size="sm" label="Paying" /> : `Pay ${m(split.total_cents)}`}
          </Button>
        )}
      </div>

      <LocalSheet open={cardSheet} onClose={() => setCardSheet(false)} ariaLabel="Your cards">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <p className="pt-2 pb-3 text-lg font-semibold">Your cards</p>
          <div className="border-border scrollbar-hide min-h-0 overflow-y-auto rounded-2xl border" role="radiogroup" aria-label="Card">
            {(cards ?? []).map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={card?.id === c.id}
                onClick={() => {
                  setPmPick(c.id);
                  setCardSheet(false);
                }}
                className={cn("flex h-12 w-full items-center justify-between gap-3 px-4 text-left", i > 0 && "border-border border-t")}
              >
                <span className="text-base">
                  <span className="font-semibold">{brandLabel(c.brand)}</span> •••• {c.last4}
                </span>
                <span className={cn("h-5 w-5 shrink-0 rounded-full border-2", card?.id === c.id ? "border-foreground bg-foreground" : "border-border")} aria-hidden />
              </button>
            ))}
            <button
              type="button"
              className="border-border text-muted-foreground hover:text-foreground flex h-12 w-full items-center border-t px-4 text-sm font-semibold"
              disabled={adding}
              onClick={() => void addCard()}
            >
              {adding ? "Opening…" : "Add another card"}
            </button>
          </div>
        </div>
      </LocalSheet>
    </div>
  );
}

function SplitLine({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex h-7 items-center justify-between gap-3">
      <span className="text-muted-foreground flex items-center gap-2 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
        {label}
      </span>
      <span>{value}</span>
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
    <div className="flex min-h-0 flex-1 flex-col" data-pay-tab-card>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <p className="w-full truncate text-base font-semibold">{tab.place.name ?? "A Mesita place"}</p>
        <p className="font-display mt-3 text-4xl font-semibold tabular-nums">{m(tab.card_bill_cents + tab.card_tip_cents)}</p>
        <p className="text-muted-foreground mt-1 text-base">on your card</p>
        <p className="mt-5 flex items-center gap-2 text-base font-semibold" role="status" aria-live="polite">
          <Dot />
          {checking ? "Checking with your bank" : action ? "Your bank wants to check this payment" : "Your card is going through"}
        </p>
        <ReconnectingLine on={reconnecting} />
        {tab.cash_due_cents > 0 ? (
          <p className="text-muted-foreground mt-4 text-sm tabular-nums">Then you give the waiter {m(tab.cash_due_cents)} in cash</p>
        ) : null}
      </div>
      {action && !checking ? (
        <Button size="lg" className="mt-4 w-full shrink-0 text-base font-semibold" onClick={() => onFinishCheck(action)}>
          Finish the bank check
        </Button>
      ) : null}
    </div>
  );
}

// ── 4. The cash ──────────────────────────────────────────────────────────────

function CashScreen({ tab, reconnecting, busy, onChange }: { tab: GuestTab; reconnecting: boolean; busy: boolean; onChange: () => void }) {
  const m = (c: number) => money(c, tab.currency);
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-pay-tab-cash>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <p className="w-full truncate text-base font-semibold">{tab.place.name ?? "A Mesita place"}</p>
        <p className="text-muted-foreground mt-3 text-base">Give the waiter</p>
        <p className="font-display mt-1 text-4xl font-semibold tabular-nums" data-tab-cash-due>
          {m(tab.cash_due_cents)}
        </p>
        <p className="text-muted-foreground mt-1 text-base">in cash</p>
        <p className="mt-4 flex items-center gap-2 text-base font-semibold" role="status" aria-live="polite">
          <Dot />
          Waiting for the waiter to tap Received
        </p>
        <ReconnectingLine on={reconnecting} />
      </div>
      <div className="border-border mt-3 flex shrink-0 flex-col rounded-2xl border px-4 py-2 text-sm tabular-nums">
        {tab.credit_cents > 0 ? <SplitLine label="Bill · credit" value={m(tab.credit_cents)} /> : null}
        {tab.card_bill_cents > 0 ? <SplitLine label="Bill · card (paid)" value={m(tab.card_bill_cents)} /> : null}
        {tab.cash_bill_cents > 0 ? <SplitLine label="Bill · cash" value={m(tab.cash_bill_cents)} /> : null}
        {tab.card_tip_cents > 0 ? <SplitLine label="Tip · card (paid)" value={m(tab.card_tip_cents)} /> : null}
        {tab.cash_tip_cents > 0 ? <SplitLine label="Tip · cash" value={m(tab.cash_tip_cents)} /> : null}
        {tab.credit_cents > 0 && tab.card_bill_cents + tab.card_tip_cents === 0 ? (
          <p className="text-muted-foreground py-1">Your credit is taken when the waiter taps Received.</p>
        ) : null}
      </div>
      <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3 shrink-0")} disabled={busy} onClick={onChange}>
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
