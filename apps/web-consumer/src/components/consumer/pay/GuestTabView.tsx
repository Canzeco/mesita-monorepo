"use client";

import { useEffect, useState } from "react";
import { Banknote, CircleCheck, Clock, Coins, HandCoins, Loader2, Smartphone, Wallet, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { SizedImg } from "@mesita/place-profile";
import { Button } from "@/components/ui/button";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiCancelTab, apiGetTab, type GuestTab, runBankCheck, TAB_REFUSAL, type TabCardStep } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { clearGuestDraft, reopenGuestDraft } from "@/lib/guest-pay-draft";
import { BAD, GOOD, GOOD_TINT, MoneyRow, NOT_PAID_REASON, PaySection, PayTop, StepBody, StepFooter, WAIT } from "./pay-flow";
import { forgetGuestTab, NETWORK_FAILURE, QUIET_BUTTON_CLASS, readGuestQr, rememberGuestTab } from "./pay-common";
import { STEP, skippedFromParts } from "@/lib/guest-pay-stages";

// THE GUEST'S BILL (MESITA-3861, Pato's "14. Payments Flow Guest-Lead"), at
// /pay/bill/<id>, after App Pay, "I gave the cash" or credits alone:
//
//   5 Sign        mostly a large QR, the place's name above it, a chip with
//                 the way it's paid, an amber Clock counting down the ten
//                 minutes, and "Once the waiter signs, this payment is final."
//                 Nothing is editable; the X cancels and goes back to the
//                 bill with everything typed.
//   Confirming    a Loader and "Confirming…" while money moves (the bank's
//                 check, the charge at the signature).
//   6 Receipt     green: CircleCheck, the place, the time, the lines with
//                 their icons, "Signed by staff", the green Coins card.
//   Not paid      a red XCircle, one line why, "Nothing was charged", Start
//                 again (the bill with everything typed).
//
// The page reads the bill every two seconds while it's open.

const POLL_MS = 2000;

export function GuestTabView({
  tab: first,
  place,
  getSupabase,
  onPayAgain,
  onDone,
  registerClose,
}: {
  tab: GuestTab;
  /** The place's photo, from the Pay list (null while it loads). */
  place: PayPlace | null;
  getSupabase: () => Parameters<typeof apiGetTab>[0];
  /** Back to the bill at this place, everything typed. */
  onPayAgain: (placeId: string) => void;
  onDone: () => void;
  /** The header's X (MESITA-3880): on Sign it closes; the bill keeps waiting (MESITA-3908). */
  registerClose?: (close: (() => void) | null) => void;
}) {
  const [tab, setTab] = useState(first);
  const [qr, setQr] = useState<string | null>(() => readGuestQr(first.tab_id));
  const [cardAction, setCardAction] = useState<TabCardStep | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const m = (c: number) => money(c, tab.currency);
  const card = tab.card_bill_cents + tab.card_tip_cents;
  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const tip = tab.card_tip_cents + tab.cash_tip_cents;
  const total = tab.credit_cents + card + cash;
  const signed = tab.status === "paid" && !!tab.verified_at;
  const ended = tab.status === "cancelled" || tab.status === "expired";
  const cardFailed = tab.parts.some((p) => p.part === "card" && !p.paid_at && (p.status === "failed" || p.status === "expired"));
  // The bank hasn't held the card yet, or the charge runs at the signature.
  const cardMoving = card > 0 && tab.parts.some((p) => p.part === "card" && (p.status === "open" || p.status === "opening") && !p.held_at && !p.paid_at);
  const confirming = !signed && !ended && (tab.signing === true || cardMoving);
  const leftMs = Date.parse(tab.expires_at) - now;
  const done = signed || ended;

  // A lost QR (a new browser) is minted again, only for this guest's own bill.
  useEffect(() => {
    if (qr || done) return;
    let cancelled = false;
    void apiGetTab(getSupabase(), tab.tab_id, { remint: true })
      .then((r) => {
        if (cancelled || !r.qr_url) return;
        rememberGuestTab(tab.tab_id, r.qr_url);
        setQr(r.qr_url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr, done, tab.tab_id]);

  // The poll: every two seconds while the bill is open and the page shows.
  useEffect(() => {
    if (done) return;
    let alive = true;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState !== "visible") return;
      void apiGetTab(getSupabase(), tab.tab_id)
        .then((r) => {
          if (!alive) return;
          setTab(r.tab);
          setCardAction(r.card_action ?? null);
          if (r.card_error) setCardError(r.card_error.code);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, tab.tab_id]);

  // Sign only: the header's X asks to cancel; the other states keep Back.
  const signing = !done && !confirming;
  useEffect(() => {
    if (!registerClose) return;
    registerClose(signing ? onDone : null);
    return () => registerClose(null);
  }, [registerClose, signing, onDone]);

  useEffect(() => {
    if (!done) return;
    forgetGuestTab(tab.tab_id);
    if (signed) clearGuestDraft(tab.place.id);
  }, [done, signed, tab.tab_id, tab.place.id]);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await apiCancelTab(getSupabase(), tab.tab_id, "cancel");
      forgetGuestTab(tab.tab_id);
      // Cancelling closes (MESITA-4018): what was typed goes too.
      clearGuestDraft(tab.place.id);
      onDone();
    } catch (e) {
      const code = e instanceof EFError ? e.code : null;
      setError((code && TAB_REFUSAL[code]) || NETWORK_FAILURE);
      setBusy(false);
      setConfirmCancel(false);
    }
  }

  const placeName = tab.place.name ?? "A Mesita place";
  const wayIcon = card > 0 ? <Smartphone /> : cash > 0 ? <Banknote /> : <Wallet />;
  const wayWords = card > 0 ? `${m(card)} by card` : cash > 0 ? `${m(cash)} cash` : `${m(tab.credit_cents)} credits`;

  // 6 RECEIPT.
  if (signed) {
    const back = tab.cashback_cents;
    // The rate the bill earned (MESITA-4058: 0% is said, not hidden).
    const backBps = card > 0 ? tab.rates.card_back_bps : cash > 0 ? tab.rates.cash_back_bps : 0;
    return (
      <div className="-mx-4 -mt-4 flex min-h-0 flex-1 flex-col" data-guest-tab="receipt">
        <div className="flex shrink-0 flex-col items-center bg-green-700 px-4 pt-6 pb-4 text-white">
          <CircleCheck className="h-14 w-14" aria-hidden />
          {/* No time once signed (MESITA-4133, Pato: "once you sign the
              visit, that timer must be gone"). */}
          <h2 className="font-display mt-3 text-xl font-semibold">Paid</h2>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
          {/* One panel (MESITA-4072): the place, the money rows, and what the
              bill earned as its last row, hairlines between. */}
          <PaySection className="divide-border divide-y text-base">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="bg-muted h-10 w-10 shrink-0 overflow-hidden rounded-full" aria-hidden>
                {place?.photo ? <SizedImg src={place.photo} size="thumb" alt="" className="h-full w-full object-cover" /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-semibold">{placeName}</span>
            </div>
            {tab.credit_cents > 0 ? <MoneyRow icon={<Wallet />} label="Credits" value={m(tab.credit_cents)} /> : null}
            {tab.card_bill_cents > 0 ? <MoneyRow icon={<Smartphone />} label="Card" value={m(tab.card_bill_cents)} /> : null}
            {tab.cash_bill_cents > 0 ? <MoneyRow icon={<Banknote />} label="Cash" value={m(tab.cash_bill_cents)} /> : null}
            {tip > 0 ? <MoneyRow icon={<HandCoins />} label="Tip" value={m(tip)} /> : null}
            <MoneyRow label="Total" value={m(total)} strong />
            <MoneyRow label="Signed by staff" value="" />
            {back > 0 ? (
              <div className={cn("flex min-h-11 items-center gap-3 px-4 py-3 font-semibold", GOOD, GOOD_TINT)} data-guest-cashback>
                <Coins className="h-5 w-5 shrink-0" aria-hidden />
                {/* Available at once (MESITA-3909). */}
                <span className="flex-1">+{m(back)} back as credits here</span>
              </div>
            ) : (
              <div className="text-muted-foreground flex min-h-11 items-center gap-3 px-4 py-3" data-guest-cashback>
                <Coins className="h-5 w-5 shrink-0" aria-hidden />
                <span>{backBps / 100}% back as credits</span>
              </div>
            )}
          </PaySection>
          <div className="min-h-0 flex-1" aria-hidden />
          <Button size="lg" className="mt-3 mb-4 min-h-12 w-full shrink-0 text-base font-semibold" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  // NOT PAID.
  if (ended) {
    const reason =
      NOT_PAID_REASON[tab.end_reason ?? ""] ??
      (cardError && NOT_PAID_REASON[cardError]) ??
      (tab.status === "expired" ? NOT_PAID_REASON.expired : cardFailed ? NOT_PAID_REASON.card_declined : NOT_PAID_REASON.cancelled);
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-guest-tab="not-paid">
        <PayTop place={place} name={tab.place.name} />
        <StepBody>
          <PaySection className="flex flex-col items-center p-4 text-center">
            <XCircle className={cn("h-10 w-10", BAD)} aria-hidden />
            <h2 className="font-display mt-2 text-xl font-semibold">Not paid</h2>
            <p className="mt-2 text-base">{reason}</p>
            <p className="text-muted-foreground mt-1 max-w-xs text-sm">
              {cash > 0 ? "Nothing was charged in Mesita. If you gave cash, settle it with the waiter." : "Nothing was charged"}
            </p>
          </PaySection>
        </StepBody>
        <Button
          size="lg"
          className="min-h-12 w-full shrink-0 text-base font-semibold"
          onClick={() => {
            reopenGuestDraft(tab.place.id);
            onPayAgain(tab.place.id);
          }}
        >
          Start again
        </Button>
        <button
          type="button"
          className={cn(QUIET_BUTTON_CLASS, "mt-2 shrink-0")}
          onClick={() => {
            // Closing a bill that didn't go through ends its ticket (MESITA-3879).
            clearGuestDraft(tab.place.id);
            onDone();
          }}
        >
          Close
        </button>
      </div>
    );
  }

  // CONFIRMING.
  if (confirming) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-guest-tab="confirming">
        <PayTop place={place} name={tab.place.name} />
        <StepBody>
          <PaySection className="flex flex-col items-center p-4 text-center" data-guest-confirming>
            <div role="status" className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 animate-spin motion-reduce:animate-none" aria-hidden />
              <h2 className="font-display mt-2 text-xl font-semibold">Confirming…</h2>
            </div>
          </PaySection>
        </StepBody>
        {cardAction ? (
          <Button
            size="lg"
            className="min-h-12 w-full shrink-0 text-base font-semibold"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void runBankCheck(cardAction).finally(() => setBusy(false));
            }}
          >
            Finish the bank check
          </Button>
        ) : null}
      </div>
    );
  }

  // 5 SIGN.
  const secs = Math.max(0, Math.ceil(leftMs / 1000));
  const countdown = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-guest-tab="sign">
      {/* MESITA-4061: the same frame as every guest step. The bill is open,
          so neither arrow acts: going back is Cancel bill, the footer. */}
      <PayTop place={place} name={tab.place.name} step={{ at: STEP.sign, skipped: skippedFromParts(tab.parts) }} />
      {/* FITS THE SCREEN, NEVER SCROLLS (MESITA-4102, Pato: "optimize
          vertical space ... i should not be scrolling here"). The body, the
          panel and the QR's slot are one column that fills the height left;
          the QR takes what remains (up to 280px) instead of guessing the
          frame's height. The way sits on the heading's right, and the timer
          and the "final" note share one line. */}
      <StepBody className="min-h-0 flex-1">
        {/* One panel (MESITA-4072): the heading inside, then the QR and the
            timer, centred. The QR's white square wears no border of its own:
            never a box in a box. */}
        <PaySection
          title="Show your waiter"
          action={
            <span className="border-border flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold tabular-nums [&>svg]:h-4 [&>svg]:w-4">
              {wayIcon}
              {wayWords}
            </span>
          }
          className="flex min-h-0 flex-1 flex-col"
        >
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2 p-4 pt-3 text-center">
          {/* MESITA-3913: what the signature earns, Available at once. */}
          {(tab.cashback_on_sign_cents ?? 0) > 0 ? (
            <p className={cn("flex shrink-0 items-center justify-center gap-1.5 text-sm font-semibold", GOOD)} data-guest-sign-cashback>
              <Coins className="h-4 w-4" aria-hidden />+{m(tab.cashback_on_sign_cents ?? 0)} back as credits once the waiter signs
            </p>
          ) : null}
          {/* The QR's slot takes the height left; the square is as tall as
              the slot allows, never over 280px, never under 140px. */}
          <div className="flex min-h-[140px] w-full flex-1 items-center justify-center">
            <div className="flex aspect-square h-full max-h-[280px] max-w-full items-center justify-center rounded-2xl bg-white">
              {qr ? (
                <QRCodeSVG value={qr} size={280} marginSize={0} style={{ width: "100%", height: "100%" }} title="Your bill's QR for the waiter" />
              ) : (
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" aria-label="Loading the QR" />
              )}
            </div>
          </div>
          <p className="flex shrink-0 flex-wrap items-center justify-center gap-x-1.5 text-sm tabular-nums" role="timer" aria-live="off">
            <Clock className={cn("h-4 w-4", WAIT)} aria-hidden />
            <span className={cn("text-base font-semibold", WAIT)}>{countdown}</span>
            {/* Honest about the end (MESITA-4130, Pato: "not then it's final,
                just then it cancels"): an unsigned bill expires, its card hold
                and credit are released, nothing is charged. */}
            <span className="text-muted-foreground">left to sign · if not, it cancels and nothing is charged</span>
          </p>
          {error ? (
            <p className="text-destructive shrink-0 text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {tab.test_mode && qr ? (
            <a href={qr} target="_blank" rel="noopener noreferrer" className="text-muted-foreground flex h-6 shrink-0 items-center text-xs font-semibold underline" data-open-as-waiter>
              Open as waiter (test)
            </a>
          ) : null}
        </div>
        </PaySection>
      </StepBody>
      <StepFooter onCancel={() => setConfirmCancel(true)} cancelDisabled={busy} />

      <LocalDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} ariaLabel="Cancel this bill">
        <div className="p-5">
          <p className="text-base font-semibold">Cancel this bill?</p>
          {/* WHAT COMES BACK, PART BY PART (MESITA-4106, Pato: "mention that
              you can get your credits back, but that if you paid with money
              ... your money is gone"). Cancel (consumer-web-cancel-tab mode
              "cancel") spends no credit and releases the card hold; cash
              already in the waiter's hand is outside Mesita, the one loss. */}
          <ul className="mt-2 flex flex-col gap-1.5 text-sm" data-guest-cancel-parts>
            {tab.credit_cents > 0 ? (
              <li className="text-muted-foreground">Your {m(tab.credit_cents)} of credits stay in your Wallet.</li>
            ) : null}
            {card > 0 ? (
              <li className="text-muted-foreground">Your card is not charged: the {m(card)} hold is released.</li>
            ) : null}
            {cash > 0 ? (
              <li className="text-destructive font-semibold">
                Cash you already gave the waiter ({m(cash)}) is not returned by Mesita. Ask the place for it.
              </li>
            ) : null}
            {tab.credit_cents === 0 && card === 0 && cash === 0 ? <li className="text-muted-foreground">Nothing is paid.</li> : null}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button className="min-h-12 flex-1 text-base font-semibold" disabled={busy} onClick={() => void cancel()}>
              {busy ? "Cancelling…" : "Cancel bill"}
            </Button>
            <button type="button" className={cn(QUIET_BUTTON_CLASS, "flex-1")} onClick={() => setConfirmCancel(false)}>
              Keep it
            </button>
          </div>
        </div>
      </LocalDialog>
    </div>
  );
}
