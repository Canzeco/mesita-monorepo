"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, Check, ChevronRight, Coins, HandCoins, Lock, Plus, ReceiptText, Smartphone, Wallet, XCircle } from "lucide-react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { LocalDialog, LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiAddCard, apiListCards, brandLabel, CARD_REFUSAL, CARD_RETURN_PARAM, type SavedCard } from "@/lib/api/cards";
import { apiListVisits, apiPayGuest, type PayWith, runBankCheck, TAB_REFUSAL } from "@/lib/api/tab";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { money, type PayPlace } from "@/lib/api/wallet";
import { acceptCardsAnswer, type CardsLoad, cardsFailure, loadedCards, pickCard } from "@/lib/pay-cards";
import { payDraftExpired } from "@/lib/pay-draft";
import { type PadKey, paySplit, pressKey, readTip } from "@/lib/pay-keypad";
import { clearSessionHref } from "@/lib/stale-session";
import { cn } from "@/lib/utils";
import { AmountDisplay, AmountKeypad } from "./AmountKeypad";
import { BackStep, BAD, GOOD, GOOD_TINT, MoneyRow, NOT_PAID_REASON, PlaceBar, PlaceHero, RowsCard, StepsBar } from "./pay-flow";
import { NETWORK_FAILURE, QUIET_BUTTON_CLASS, rememberGuestTab } from "./pay-common";

// THE GUEST PAYS (MESITA-3861, Pato's "14. Payments Flow Guest-Lead"), at
// /pay/<placeId>, one screen a step:
//
//   1 Open    the place large across the top (photo, name, MapPin and the
//             distance); tapping the name opens the search; Off says why.
//   2 Bill    a large keypad under ReceiptText; then the tip chips (0, 10%,
//             15%, Other) with HandCoins, the Wallet switch "Use my credits"
//             (on by default; credits never pay the tip) and the summary
//             card: Bill, Credits, Left to pay, Tip, Total, and the green
//             Coins line. Nothing left to pay and no tip: straight to Sign.
//   3 Method  App or Cash, one way for everything that's left; the chosen
//             tile has a thick border; the Coins line follows the choice.
//   4A App    the saved card and "Pay MX$X": the card is held, charged when
//             the waiter signs.
//   4B Cash   "Give MX$X to the waiter", then "I gave the cash".
//
// Paying opens the bill (/pay/tab/<id>, GuestTabView: Sign, Confirming,
// Receipt, Not paid). The header's back arrow steps back.
//
// ONE TICKET AT A TIME (MESITA-3879, Pato: "imagine someone closes the app
// while in one step in between ... you first need to enter the ticket and
// resolve it before anything"): the draft lives in localStorage with one
// pending pointer once an amount is typed. While it's pending, /pay and
// every other place's Pay open it where it was left; the X (or the place
// name) asks "Cancel this ticket?" and clears it. A bill already open on the
// server comes first. Drafts still expire 30 minutes after their last change. Every rule and peso is the
// server's; this screen proposes.

type Stage = "bill" | "method" | "pay";
/** 10% · 15% · 20% · Other (MESITA-3876, Pato: "10 15 or 20. and other at
 *  the end"); no tip is Other with 0 typed. */
type Tip = 10 | 15 | 20 | "other" | null;
const TIP_CHIPS = [10, 15, 20] as const;

type Draft = {
  stage: Stage;
  typing: boolean;
  amount: string;
  tip: Tip;
  other: string;
  useCredit: boolean;
  method: PayWith | null;
  cardId: string | null;
  savedAt: number;
};

const DRAFT_KEY = (placeId: string) => `mesita.pay.guest-lead.${placeId}`;
/** The place whose ticket is in progress (MESITA-3879). */
const PENDING_KEY = "mesita.pay.pending-ticket";

function readDraft(placeId: string): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const d = JSON.parse(window.localStorage.getItem(DRAFT_KEY(placeId)) ?? "null") as Draft | null;
    if (!d || typeof d.amount !== "string" || typeof d.savedAt !== "number") return null;
    if (payDraftExpired(d.savedAt, Date.now())) return null;
    return d;
  } catch {
    return null;
  }
}

/** Saves the draft, stamped now; null removes it. */
function writeDraft(placeId: string, d: Omit<Draft, "savedAt"> | null) {
  try {
    if (d) window.localStorage.setItem(DRAFT_KEY(placeId), JSON.stringify({ ...d, savedAt: Date.now() }));
    else window.localStorage.removeItem(DRAFT_KEY(placeId));
    // A ticket is pending once an amount is typed.
    const pending = window.localStorage.getItem(PENDING_KEY);
    if (d && d.amount !== "") window.localStorage.setItem(PENDING_KEY, placeId);
    else if (pending === placeId) window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // The bill starts empty next time; nothing breaks.
  }
}

/** The place with a ticket in progress (an amount typed, not expired), or null. */
export function pendingTicketPlace(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const placeId = window.localStorage.getItem(PENDING_KEY);
    if (!placeId) return null;
    const d = readDraft(placeId);
    if (d && d.amount !== "") return placeId;
    window.localStorage.removeItem(PENDING_KEY);
    return null;
  } catch {
    return null;
  }
}

/** The receipt (or Close on Not paid) clears what was typed at this place. */
export function clearGuestDraft(placeId: string) {
  if (typeof window !== "undefined") writeDraft(placeId, null);
}

/** "Start again" lands on the bill, everything typed, keypad down. */
export function reopenGuestDraft(placeId: string) {
  const d = readDraft(placeId);
  if (d) writeDraft(placeId, { ...d, stage: "bill", typing: false });
}

export function GuestPayScreen({
  placeId,
  places,
  placesFailed,
  getSupabase,
  onPaid,
  onChoosePlace,
  onOpenPlace,
  registerBack,
}: {
  placeId: string;
  places: PayPlace[] | null;
  placesFailed: boolean;
  getSupabase: () => Parameters<typeof apiListCards>[0];
  /** The bill exists (or the guest's one open bill): open it. */
  onPaid: (tabId: string) => void;
  /** Open: the search to choose another place. */
  onChoosePlace: () => void;
  /** Another place's ticket is pending: open it there (MESITA-3879). */
  onOpenPlace: (placeId: string) => void;
  /** The header's back arrow asks this first: true when it handled it. */
  registerBack?: (back: (() => boolean) | null) => void;
}) {
  const place = places?.find((p) => p.place_id === placeId) ?? null;
  const [draft] = useState(() => readDraft(placeId));
  const [stage, setStage] = useState<Stage>(draft?.stage ?? "bill");
  const [typing, setTyping] = useState(draft?.typing ?? true);
  const [amount, setAmount] = useState(draft?.amount ?? "");
  // A draft from before MESITA-3876 may hold the retired 0 chip: no pick.
  const [tip, setTip] = useState<Tip>(draft && (draft.tip === "other" || TIP_CHIPS.includes(draft.tip as 10)) ? draft.tip : null);
  const [other, setOther] = useState(draft?.other ?? "");
  const [useCredit, setUseCredit] = useState(draft?.useCredit ?? true);
  const [method, setMethod] = useState<PayWith | null>(draft?.method ?? null);
  const [cardId, setCardId] = useState<string | null>(draft?.cardId ?? null);
  const [tipSheet, setTipSheet] = useState(false);
  const [otherTyping, setOtherTyping] = useState("");
  const [cardsSheet, setCardsSheet] = useState(false);
  const [cardsLoad, setCardsLoad] = useState<CardsLoad>({ state: "loading" });
  const [cardsAttempt, setCardsAttempt] = useState(0);
  const latestCardsAttempt = useRef(0);
  const [busy, setBusy] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notPaid, setNotPaid] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const [cancelAsk, setCancelAsk] = useState(false);

  // ONE TICKET AT A TIME (MESITA-3879): another place's ticket in progress,
  // or a bill already open on the server, opens instead of this place.
  useEffect(() => {
    const other = pendingTicketPlace();
    if (other && other !== placeId) {
      onOpenPlace(other);
      return;
    }
    let cancelled = false;
    void apiListVisits(getSupabase())
      .then((r) => {
        const open = pickOpenGuestPayment(r.visits, Date.now());
        if (!cancelled && open) onPaid(open.tab_id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);
  const root = useRef<HTMLDivElement | null>(null);

  const cards = loadedCards(cardsLoad);
  const cardOk = place?.card_ok === true;
  const cashOk = place?.outside_ok === true;
  const spendable = Math.max(place?.available_cents ?? 0, 0);
  const off = !!place && !cardOk && !cashOk && spendable === 0;
  const m = (c: number) => money(c, place?.currency ?? "mxn");
  // The X and the place name: with a ticket in progress, cancel it first.
  const leave = () => {
    if (busy || addingCard) return;
    if (amount !== "") setCancelAsk(true);
    else onChoosePlace();
  };

  // The saved cards, when the place takes cards (and again on Retry).
  useEffect(() => {
    if (!cardOk) return;
    const attempt = cardsAttempt;
    latestCardsAttempt.current = attempt;
    void apiListCards(getSupabase())
      .then((r) => {
        if (acceptCardsAnswer(attempt, latestCardsAttempt.current)) setCardsLoad({ state: "loaded", cards: r.cards });
      })
      .catch((err: unknown) => {
        if (!acceptCardsAnswer(attempt, latestCardsAttempt.current)) return;
        const failed = cardsFailure(err);
        if (failed.state === "signed_out") window.location.assign(clearSessionHref(`/pay/${placeId}`));
        setCardsLoad(failed);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardOk, cardsAttempt]);

  // The sums.
  const billCents = readAmount(amount) ?? 0;
  const tipCents = tip === null ? 0 : tip === "other" ? readTip(other) ?? 0 : Math.round((billCents * tip) / 100);
  const creditOn = useCredit && spendable > 0;
  const creditCents = creditOn ? Math.min(spendable, billCents) : 0;
  const leftCents = billCents - creditCents;
  const dueCents = leftCents + tipCents;
  const cardMin = place?.card_min_cents ?? 0;
  // Why a tile is grey (one line), null when it can pay what's left.
  const appWhy = !place
    ? null
    : !cardOk
    ? "This place doesn't take cards through Mesita."
    : dueCents > 0 && dueCents < cardMin
    ? leftCents === 0
      ? `Tips under ${m(cardMin)} can't go by card. Set the tip to 0 or tip the waiter outside Mesita.`
      : `Card minimum is ${m(cardMin)}`
    : null;
  const cashWhy = place && !cashOk ? "This place doesn't take cash through Mesita." : null;
  const appOn = !appWhy;
  const cashOn = !cashWhy;
  // The way the bill goes: the guest's pick if it can, else the only one.
  const way: PayWith | null =
    method === "card" && appOn ? "card" : method === "cash" && cashOn ? "cash" : appOn && !cashOn ? "card" : cashOn && !appOn ? "cash" : null;
  const chosenCard = pickCard(cards, cardId);
  const splitFor = (w: PayWith) =>
    place
      ? paySplit({ place, billCents, tipCents, spendableCents: spendable, useCredit: creditOn, restWith: w, tipWith: w, cardId: chosenCard })
      : null;
  const cashbackFor = (w: PayWith) => splitFor(w)?.cashback_cents ?? 0;
  // The Bill's Coins line before a way is chosen: the better of the two.
  const billCashback = way ? cashbackFor(way) : Math.max(appOn ? cashbackFor("card") : 0, cashOn ? cashbackFor("cash") : 0);

  // Every change is saved, so the X and "Add a card" come back to it.
  useEffect(() => {
    requestId.current = null;
    writeDraft(placeId, { stage, typing, amount, tip, other, useCredit, method, cardId });
  }, [placeId, stage, typing, amount, tip, other, useCredit, method, cardId]);

  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [stage, typing, notPaid]);

  // The header's back arrow steps back; at the start it leaves.
  useEffect(() => {
    if (!registerBack) return;
    registerBack(() => {
      if (busy || addingCard) return true;
      if (notPaid) {
        setNotPaid(null);
        return true;
      }
      if (stage === "pay") setStage(dueCents > 0 ? "method" : "bill");
      else if (stage === "method") setStage("bill");
      else if (!typing) setTyping(true);
      else return false;
      setError(null);
      return true;
    });
    return () => registerBack(null);
  }, [registerBack, busy, addingCard, notPaid, stage, typing, dueCents]);

  async function addCard() {
    setAddingCard(true);
    setError(null);
    try {
      const back = `${window.location.origin}/pay/${placeId}?${CARD_RETURN_PARAM}=1`;
      const { url } = await apiAddCard(getSupabase(), back);
      window.location.assign(url);
    } catch (e) {
      const code = e instanceof EFError ? e.code : null;
      setError((code && code !== "checkout_failed" && CARD_REFUSAL[code]) || "Couldn't open the card page. Try again.");
      setAddingCard(false);
    }
  }

  /** Opens the bill: credits only, the card held, or the cash given. */
  async function openBill(w: PayWith | null) {
    if (!place || busy || billCents <= 0) return;
    setBusy(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    const card = w === "card" ? leftCents : 0;
    const cash = w === "cash" ? leftCents : 0;
    try {
      const r = await apiPayGuest(getSupabase(), {
        place_id: placeId,
        bill_cents: billCents,
        request_id: requestId.current,
        credit_cents: creditCents,
        card_bill_cents: card,
        card_tip_cents: w === "card" ? tipCents : 0,
        cash_bill_cents: cash,
        cash_tip_cents: w === "cash" ? tipCents : 0,
        card_pm_id: w === "card" ? chosenCard : null,
      });
      rememberGuestTab(r.tab_id, r.qr_url);
      // Start again comes back to the bill with everything typed.
      writeDraft(placeId, { stage: "bill", typing: false, amount, tip, other, useCredit, method, cardId });
      if (r.card?.status === "requires_action") await runBankCheck(r.card);
      onPaid(r.tab_id);
    } catch (e) {
      const code = e instanceof EFError ? e.code : null;
      if (code) requestId.current = null;
      const openId = code === "too_many_open" && e instanceof EFError ? e.body?.open_tab_id : null;
      if (typeof openId === "string" && openId) {
        onPaid(openId);
        return;
      }
      setBusy(false);
      if (code && NOT_PAID_REASON[code]) {
        setNotPaid(NOT_PAID_REASON[code]);
        return;
      }
      setError((code && TAB_REFUSAL[code]) || (e instanceof EFError && (e.status ?? 500) < 500 && e.message) || NETWORK_FAILURE);
    }
  }

  if (!place) {
    if (placesFailed || (places && !place)) {
      return (
        <div className="flex flex-col gap-4" data-guest-pay="unavailable">
          <p className="text-base font-semibold">This place isn&apos;t taking Mesita payments right now.</p>
          <button type="button" className={QUIET_BUTTON_CLASS} onClick={onChoosePlace}>
            Choose another place
          </button>
        </div>
      );
    }
    return <GuestPayLoading />;
  }

  // Desktop keys reach the keypad.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.metaKey || e.ctrlKey || e.altKey || stage !== "bill" || !typing) return;
    const key: PadKey | null = /^[0-9]$/.test(e.key) ? (e.key as PadKey) : e.key === "." ? "." : e.key === "Backspace" ? "back" : null;
    if (key) {
      e.preventDefault();
      setAmount((t) => pressKey(t, key));
    } else if (e.key === "Enter" && billCents > 0) {
      e.preventDefault();
      setTyping(false);
    }
  }

  const frame = (body: React.ReactNode, data: string) => (
    <div ref={root} tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none" onKeyDown={onKeyDown} data-guest-pay={data}>
      {body}
      <LocalDialog open={cancelAsk} onClose={() => setCancelAsk(false)} ariaLabel="Cancel this ticket">
        <div className="p-5" data-guest-cancel-ticket>
          <p className="text-base font-semibold">Cancel this ticket?</p>
          <p className="text-muted-foreground mt-1 text-sm">What you typed is cleared. Nothing was charged.</p>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              className="min-h-12 flex-1 text-base font-semibold"
              onClick={() => {
                setCancelAsk(false);
                clearGuestDraft(placeId);
                onChoosePlace();
              }}
            >
              Cancel ticket
            </Button>
            <button type="button" className={cn(QUIET_BUTTON_CLASS, "flex-1")} onClick={() => setCancelAsk(false)}>
              Keep it
            </button>
          </div>
        </div>
      </LocalDialog>
    </div>
  );
  const status = error ? (
    <p className="text-destructive shrink-0 pt-2 text-center text-sm" role="alert">
      {error}
    </p>
  ) : null;
  const held = busy || addingCard;

  // NOT PAID (before the bill opened: the card was refused).
  if (notPaid) {
    return frame(
      <>
        <PlaceBar place={place} onClose={leave} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <XCircle className={cn("h-14 w-14", BAD)} aria-hidden />
          <h2 className="font-display mt-4 text-xl font-semibold">Not paid</h2>
          <p className="mt-2 text-base">{notPaid}</p>
          <p className="text-muted-foreground mt-1 text-sm">Nothing was charged</p>
        </div>
        <BigButton busy={busy} held={held} onClick={() => {
          setNotPaid(null);
          setStage("bill");
          setTyping(false);
        }}>Start again</BigButton>
      </>,
      "not-paid",
    );
  }

  // OPEN, OFF: the place doesn't take Mesita payments at all.
  if (off) {
    return frame(
      <>
        <PlaceHero place={place} off onChoose={onChoosePlace} onClose={onChoosePlace} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <p className="text-base font-semibold">This place doesn&apos;t take Mesita payments.</p>
          <p className="text-muted-foreground mt-1 text-sm">Pay the usual way, outside Mesita.</p>
        </div>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={onChoosePlace}>
          Choose another place
        </button>
      </>,
      "off",
    );
  }

  // 1 OPEN + 2 BILL, TYPING: the place across the top, the keypad.
  if (stage === "bill" && typing) {
    return frame(
      <>
        <PlaceHero place={place} off={false} onChoose={leave} onClose={leave} />
        <StepsBar at={0} className="mt-3" />
        <div className="mt-4 flex shrink-0 items-center justify-center gap-2">
          <ReceiptText className="text-muted-foreground h-5 w-5" aria-hidden />
          <span className="text-muted-foreground text-sm">The amount on the paper bill</span>
        </div>
        <AmountDisplay text={amount} currency={place.currency} label="Bill" className="mt-1 shrink-0" />
        <div className="min-h-0 flex-1" aria-hidden />
        <AmountKeypad text={amount} onKey={(k) => setAmount((t) => pressKey(t, k))} />
        <BigButton busy={busy} held={held} disabled={billCents <= 0} onClick={() => setTyping(false)}>Next</BigButton>
      </>,
      "bill",
    );
  }

  const tipChip = (on: boolean) =>
    cn(
      "flex h-11 flex-1 items-center justify-center rounded-full border text-base font-semibold transition",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
    );

  // 2 BILL, REVIEW: tip, credits, the summary card.
  if (stage === "bill") {
    const tipOk = tip !== null;
    const toSign = dueCents === 0;
    return frame(
      <>
        <PlaceBar place={place} onClose={leave} />
        <StepsBar at={0} className="mt-1" />
        <button
          type="button"
          onClick={() => setTyping(true)}
          className="mt-2 flex shrink-0 flex-col items-center"
          aria-label={`Bill ${m(billCents)}. Change it`}
          data-guest-bill-amount
        >
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <ReceiptText className="h-4 w-4" aria-hidden />
            Bill
          </span>
          <span className="text-[2.5rem] leading-tight font-semibold tabular-nums">{m(billCents)}</span>
        </button>

        <div className="mt-4 shrink-0" role="group" aria-label="Tip for the staff">
          <p className="mb-2 flex items-center gap-2 text-base font-semibold">
            <HandCoins className="h-5 w-5" aria-hidden />
            Tip for the staff
          </p>
          <div className="flex gap-2">
            {TIP_CHIPS.map((p) => (
              <button key={p} type="button" className={tipChip(tip === p)} aria-pressed={tip === p} onClick={() => setTip(p)}>
                {`${p}%`}
              </button>
            ))}
            <button
              type="button"
              className={tipChip(tip === "other")}
              aria-pressed={tip === "other"}
              onClick={() => {
                setOtherTyping(other);
                setTipSheet(true);
              }}
            >
              {tip === "other" ? m(tipCents) : "Other"}
            </button>
          </div>
        </div>

        {spendable > 0 ? (
          <button
            type="button"
            role="switch"
            aria-checked={creditOn}
            onClick={() => setUseCredit((u) => !u)}
            className="mt-4 flex min-h-12 w-full shrink-0 items-center gap-3 text-left"
            data-guest-credits
          >
            <Wallet className="h-5 w-5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-base">
              <span className="font-semibold">Use my credits</span>
              <span className="text-muted-foreground"> · {m(spendable)} available</span>
            </span>
            <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", creditOn ? "bg-foreground" : "bg-border")} aria-hidden>
              <span className={cn("bg-card absolute top-0.5 h-5 w-5 rounded-full shadow transition-all", creditOn ? "left-[18px]" : "left-0.5")} />
            </span>
          </button>
        ) : null}

        <RowsCard className="mt-4 shrink-0">
          <MoneyRow label="Bill" value={m(billCents)} />
          {creditOn ? <MoneyRow label="Credits" value={`−${m(creditCents)}`} /> : null}
          <MoneyRow label="Left to pay" value={m(leftCents)} />
          <MoneyRow label="Tip" value={tipOk ? m(tipCents) : "Choose a tip"} />
          <MoneyRow label="Total" value={m(dueCents)} strong />
          <CashbackRow cents={billCashback} m={m} />
        </RowsCard>

        <div className="min-h-0 flex-1" aria-hidden />
        {status}
        <BigButton busy={busy} held={held} disabled={!tipOk || billCents <= 0} onClick={() => (toSign ? void openBill(null) : setStage("method"))}>Next</BigButton>

        <LocalSheet open={tipSheet} onClose={() => setTipSheet(false)} ariaLabel="Another tip">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <p className="flex items-center gap-2 pt-2 text-lg font-semibold">
              <HandCoins className="h-5 w-5" aria-hidden />
              Tip for the staff
            </p>
            <AmountDisplay text={otherTyping} currency={place.currency} label="Tip" className="mt-4 shrink-0" />
            <AmountKeypad text={otherTyping} onKey={(k) => setOtherTyping((t) => pressKey(t, k))} />
            <Button
              type="button"
              size="lg"
              className="mt-3 min-h-12 w-full text-base font-semibold"
              disabled={readTip(otherTyping) === null}
              onClick={() => {
                setOther(otherTyping);
                setTip("other");
                setTipSheet(false);
              }}
            >
              Set tip
            </Button>
          </div>
        </LocalSheet>
      </>,
      "review",
    );
  }

  // 3 METHOD: App or Cash for everything that's left.
  if (stage === "method") {
    return frame(
      <>
        <PlaceBar place={place} onClose={leave} />
        <StepsBar at={1} className="mt-1" />
        <BackStep to="Bill" onClick={() => !busy && setStage("bill")} />
        <p className="mt-2 shrink-0 text-center">
          <span className="text-muted-foreground block text-sm">{leftCents === 0 ? "Tip to pay" : "Left to pay"}</span>
          <span className="block text-[2.5rem] leading-tight font-semibold tabular-nums">{m(dueCents)}</span>
        </p>
        <div className="mt-4 flex shrink-0 flex-col gap-3" role="radiogroup" aria-label="How you pay">
          <MethodTile
            on={way === "card"}
            off={appWhy}
            icon={<Smartphone />}
            tone="bg-pink-gradient text-white"
            title="App"
            line="Card"
            back={(place.cashback_bps ?? 0) > 0 ? `${place.cashback_bps / 100}% back` : null}
            onPick={() => setMethod("card")}
          />
          <MethodTile
            on={way === "cash"}
            off={cashWhy}
            icon={<Banknote />}
            tone="bg-green-400 text-neutral-950"
            title="Cash"
            line="Cash or their terminal"
            back={(place.outside_bps ?? 0) > 0 ? `${(place.outside_bps ?? 0) / 100}% back` : null}
            onPick={() => setMethod("cash")}
          />
        </div>
        <p
          className={cn("mt-4 flex shrink-0 items-center justify-center gap-2 text-base font-semibold", way && cashbackFor(way) > 0 ? GOOD : "text-muted-foreground")}
          data-guest-cashback
        >
          <Coins className="h-5 w-5" aria-hidden />
          {way ? (cashbackFor(way) > 0 ? `+${m(cashbackFor(way))} back` : "No cashback") : "Choose how to pay"}
        </p>
        <div className="min-h-0 flex-1" aria-hidden />
        {status}
        <BigButton busy={busy} held={held} disabled={!way} onClick={() => {
            if (way) {
              setMethod(way);
              setStage("pay");
            }
          }}>Next</BigButton>
      </>,
      "method",
    );
  }

  // 4A APP PAY: the saved card, "Pay MX$X", held now.
  if (way === "card") {
    const card = cards?.find((c) => c.id === chosenCard) ?? null;
    const cardsUnknown = cards === null;
    return frame(
      <>
        <PlaceBar place={place} onClose={leave} />
        <StepsBar at={2} className="mt-1" />
        <BackStep to="Method" onClick={() => !busy && !addingCard && setStage("method")} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          {cardsUnknown ? (
            cardsLoad.state === "failed" ? (
              <button type="button" className="text-base font-semibold underline" onClick={() => {
                setCardsLoad({ state: "loading" });
                setCardsAttempt((n) => n + 1);
              }}>
                Couldn&apos;t load your cards. Retry
              </button>
            ) : (
              <Skeleton className="h-28 w-48 rounded-2xl" />
            )
          ) : card ? (
            <button
              type="button"
              onClick={() => setCardsSheet(true)}
              className="bg-foreground flex h-28 w-48 flex-col justify-between rounded-2xl p-4 text-left text-white"
              aria-label={`${brandLabel(card.brand)} ending ${card.last4}. Change card`}
              data-guest-card
            >
              <span className="text-base font-semibold">{brandLabel(card.brand)}</span>
              <span className="text-base font-semibold tracking-widest tabular-nums">•••• {card.last4}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void addCard()}
              disabled={addingCard}
              className="border-muted-foreground/40 text-muted-foreground flex h-28 w-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed"
              data-guest-add-card
            >
              <Plus className="h-6 w-6" aria-hidden />
              <span className="text-base font-semibold">{addingCard ? "Opening…" : "Add a card"}</span>
            </button>
          )}
          {cards && cards.length > 1 ? (
            <button type="button" className="text-muted-foreground mt-2 flex h-11 items-center gap-1 text-sm font-semibold" onClick={() => setCardsSheet(true)}>
              Change card
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <p className="text-muted-foreground flex shrink-0 items-center justify-center gap-2 text-sm">
          <Lock className="h-4 w-4" aria-hidden />
          Held now, charged when the waiter signs.
        </p>
        {status}
        {card ? (
          <BigButton busy={busy} held={held} onClick={() => void openBill("card")}>{`Pay ${m(dueCents)}`}</BigButton>
        ) : (
          <BigButton busy={busy} held={held} disabled={cardsUnknown} onClick={() => void addCard()}>{addingCard ? "Opening…" : "Add a card"}</BigButton>
        )}

        <LocalSheet open={cardsSheet} onClose={() => setCardsSheet(false)} ariaLabel="Your cards">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <p className="pt-2 pb-3 text-lg font-semibold">Your cards</p>
            <RowsCard>
              {(cards ?? []).map((c: SavedCard) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex min-h-14 items-center justify-between gap-3 px-4 text-left"
                  onClick={() => {
                    setCardId(c.id);
                    setCardsSheet(false);
                  }}
                >
                  <span className="text-base font-semibold">
                    {brandLabel(c.brand)} •••• {c.last4}
                  </span>
                  {c.id === chosenCard ? <Check className="h-5 w-5" aria-hidden /> : null}
                </button>
              ))}
              {(cards ?? []).length < 3 ? (
                <button type="button" className="flex min-h-14 items-center gap-3 px-4 text-left text-base font-semibold" onClick={() => void addCard()}>
                  <Plus className="h-5 w-5" aria-hidden />
                  Add a card
                </button>
              ) : null}
            </RowsCard>
          </div>
        </LocalSheet>
      </>,
      "app",
    );
  }

  // 4B CASH PAY: give the cash, then the QR.
  return frame(
    <>
      <PlaceBar place={place} onClose={leave} />
      <StepsBar at={2} className="mt-1" />
      <BackStep to="Method" onClick={() => !busy && !addingCard && setStage("method")} />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <span className="flex h-28 w-28 items-center justify-center rounded-full bg-green-400 text-neutral-950" aria-hidden>
          <Banknote className="h-14 w-14" />
        </span>
        <p className="mt-6 text-[2.5rem] leading-tight font-semibold tabular-nums">{m(dueCents)}</p>
        <h2 className="font-display mt-1 text-xl font-semibold">Give {m(dueCents)} to the waiter</h2>
        <p className="text-muted-foreground mt-1 text-sm">Then show them the QR</p>
      </div>
      {status}
      <BigButton busy={busy} held={held} onClick={() => void openBill("cash")}>I gave the cash</BigButton>
    </>,
    "cash",
  );
}

/** The one dark button, pinned at the bottom. */
function BigButton({
  children,
  onClick,
  busy,
  held,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  held: boolean;
  disabled?: boolean;
}) {
  return (
    <Button type="button" size="lg" className="mt-3 min-h-12 w-full shrink-0 text-base font-semibold" disabled={disabled || held} onClick={onClick}>
      {busy ? <Spinner size="sm" label="Working" /> : children}
    </Button>
  );
}

/** The summary's last row: the green Coins line, or "No cashback". */
function CashbackRow({ cents, m }: { cents: number; m: (c: number) => string }) {
  return cents > 0 ? (
    <div className={cn("flex min-h-11 items-center gap-3 px-4 font-semibold", GOOD, GOOD_TINT)} data-guest-cashback>
      <Coins className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1">+{m(cents)} back</span>
    </div>
  ) : (
    <div className="text-muted-foreground flex min-h-11 items-center gap-3 px-4" data-guest-cashback>
      <Coins className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1">No cashback</span>
    </div>
  );
}

/** A large tile for App or Cash: thick border when chosen, grey with one
 *  line why when the place can't take it. */
function MethodTile({
  on,
  off,
  icon,
  tone,
  title,
  line,
  back,
  onPick,
}: {
  on: boolean;
  off: string | null;
  icon: React.ReactNode;
  /** The way's own colour (MESITA-3877): App the brand pink, Cash the
   *  Wallet's Cash green. Grey when the place can't take it. */
  tone: string;
  title: string;
  line: string;
  back: string | null;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-disabled={!!off}
      onClick={() => !off && onPick()}
      className={cn(
        "relative flex min-h-24 w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition",
        off ? "bg-muted border-border text-muted-foreground border" : on ? "border-foreground border-[3px]" : "border-border hover:bg-muted/60 border",
      )}
      data-guest-method={title.toLowerCase()}
    >
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full [&>svg]:h-6 [&>svg]:w-6", off ? "bg-card" : tone)} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="text-muted-foreground block text-sm">{off ?? line}</span>
      </span>
      {!off && back ? <span className={cn("shrink-0 rounded-full px-3 py-1 text-sm font-semibold", GOOD, GOOD_TINT)}>{back}</span> : null}
      {on ? (
        <span className="bg-foreground text-background absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full" aria-hidden>
          <Check className="h-4 w-4" />
        </span>
      ) : null}
    </button>
  );
}

/** The bill in bones while the place loads (also the pay pages' loading). */
export function GuestPayLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-guest-pay="loading" aria-busy>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="mt-5 h-12 w-1/2 self-center" />
      <div className="min-h-0 flex-1" />
      <Skeleton className="h-60 w-full rounded-2xl" />
      <Skeleton className="mt-3 h-12 w-full rounded-2xl" />
    </div>
  );
}
