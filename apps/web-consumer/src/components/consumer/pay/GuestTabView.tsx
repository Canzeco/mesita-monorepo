"use client";

import { useEffect, useState } from "react";
import { Banknote, CircleCheck, Clock, HandCoins, Loader2, PenLine, Smartphone, Wallet, XCircle } from "lucide-react";
import { Skeleton } from "@/components/shared/Skeleton";
import { QRCodeSVG } from "qrcode.react";
import { SizedImg } from "@mesita/place-profile";
import { Button } from "@/components/ui/button";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiCancelTab, apiGetTab, type GuestTab, runBankCheck, TAB_REFUSAL, type TabCardStep } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { useWakeLock } from "@/lib/use-wake-lock";
import { clearGuestDraft, reopenGuestDraft } from "@/lib/guest-pay-draft";
import { BAD, GOOD, MoneyRow, NOT_PAID_REASON, PaySection, PayTop, StepBody, StepFooter, WAIT } from "./pay-flow";
import { forgetGuestTab, NETWORK_FAILURE, QUIET_BUTTON_CLASS, readGuestQr, rememberGuestTab, CancelBillButtons } from "./pay-common";
import { STEP, startAgainStage } from "@/lib/guest-pay-stages";

// THE GUEST'S BILL (MESITA-3861, Pato's "14. Payments Flow Guest-Lead"), at
// /pay/bill/<id>, after App Pay, "I gave the cash" or credits alone:
//
//   6 Sign        mostly a large QR; the countdown on the heading's right;
//                 under the QR the bill's total with the way it's paid, what
//                 the signature earns, and that an unsigned bill cancels
//                 with nothing charged. Nothing is editable; Cancel bill goes back to the
//                 bill with everything typed. The screen stays on.
//   Confirming    a Loader and "Confirming…" while money moves (the bank's
//                 check, the charge at the signature).
//   7 Receipt     the step panel, a green Paid with the total, the lines
//                 with their icons, "Signed by staff" ✓; Done.
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
  // MESITA-4131: a QR that didn't come says so (it spun forever), and two
  // failed reads in a row say "Reconnecting…", the table bill's words.
  const [qrFailed, setQrFailed] = useState(false);
  const [qrTry, setQrTry] = useState(0);
  const [failedReads, setFailedReads] = useState(0);

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
        if (cancelled) return;
        if (!r.qr_url) {
          setQrFailed(true);
          return;
        }
        rememberGuestTab(tab.tab_id, r.qr_url);
        setQr(r.qr_url);
      })
      .catch(() => {
        if (!cancelled) setQrFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr, done, tab.tab_id, qrTry]);

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
          setFailedReads(0);
          setTab(r.tab);
          setCardAction(r.card_action ?? null);
          if (r.card_error) setCardError(r.card_error.code);
        })
        .catch(() => {
          if (alive) setFailedReads((n) => n + 1);
        });
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, tab.tab_id]);

  // Sign only: the header's X asks to cancel; the other states keep Back.
  const signing = !done && !confirming;
  // The phone must not lock while the guest waits for the waiter (MESITA-4131).
  useWakeLock(signing);
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
  // Every way this bill is paid (MESITA-4131): Sign named the card part alone,
  // so a bill split with credits or cash showed less than the bill.
  const ways = [
    tab.credit_cents > 0 ? { key: "credits", icon: <Wallet aria-hidden />, cents: tab.credit_cents, alone: "credits", part: "credits" } : null,
    card > 0 ? { key: "card", icon: <Smartphone aria-hidden />, cents: card, alone: "by card", part: "card" } : null,
    cash > 0 ? { key: "cash", icon: <Banknote aria-hidden />, cents: cash, alone: "cash", part: "cash" } : null,
  ].filter((w) => w !== null);

  // MESITA-4386: "Paid with Apple Pay / Google Pay": the card row names the wallet.
  const payWith = tab.parts.find((p) => p.part === "card" && p.paid_at)?.pay_with;
  const cardLabel = payWith === "apple_pay" ? "Apple Pay" : payWith === "google_pay" ? "Google Pay" : "Card";

  // 7 RECEIPT (MESITA-4135, Pato: "a better design when the tickets are gone
  // ... keep the structure"). The same three
  // parts as before, green Paid, one panel of rows, Done, now under the step
  // panel ("Receipt · 6 of 6", the sixth segment shown only here): Paid carries the total, Signed by staff
  // carries its check, and the footer is Done.
  if (signed) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-guest-tab="receipt">
        <PayTop place={place} name={tab.place.name} step={{ at: STEP.receipt }} />
        <StepBody className="min-h-0 flex-1">
          {/* Paid, one green row with the total (it was a full-bleed band
              140px tall; under the step panel the rows and the gift must
              still fit a small phone). No time once signed (MESITA-4133). */}
          <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-green-700 px-4 py-3 text-left text-white" data-guest-paid>
            <CircleCheck className="h-8 w-8 shrink-0" aria-hidden />
            <h2 className="font-display flex-1 text-xl font-semibold">Paid</h2>
            <p className="text-2xl font-semibold tabular-nums">{m(total)}</p>
          </div>
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
            {tab.card_bill_cents > 0 ? <MoneyRow icon={<Smartphone />} label={cardLabel} value={m(tab.card_bill_cents)} /> : null}
            {tab.cash_bill_cents > 0 ? <MoneyRow icon={<Banknote />} label="Cash" value={m(tab.cash_bill_cents)} /> : null}
            {tip > 0 ? <MoneyRow icon={<HandCoins />} label="Tip" value={m(tip)} /> : null}
            <MoneyRow label="Total" value={m(total)} strong />
            <MoneyRow
              icon={<PenLine />}
              label="Signed by staff"
              value={<CircleCheck className={cn("h-5 w-5", GOOD)} aria-label="Signed" />}
            />
          </PaySection>
        </StepBody>
        {/* The footer, always in reach. */}
        <div className="border-border -mx-4 mt-3 grid shrink-0 gap-3 border-t px-4 pt-3">
          <Button size="lg" className="min-h-12 w-full text-base font-semibold" onClick={onDone}>
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
            // Start again opens where the bill failed (MESITA-4121).
            // A failed card reopens Pay with it marked "Declined just now"
            // (MESITA-4226).
            const stage = startAgainStage({ endReason: tab.end_reason ?? cardError, cardFailed });
            reopenGuestDraft(tab.place.id, stage, stage === "pay");
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
  // Amber only when the time is nearly out: it read as an alarm with most of
  // an hour left (MESITA-4131).
  const closing = secs <= 120;
  const reconnecting = failedReads >= 2;
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-guest-tab="sign">
      {/* MESITA-4061: the same frame as every guest step. The bill is open,
          so neither arrow acts: going back is Cancel bill, the footer. */}
      <PayTop place={place} name={tab.place.name} step={{ at: STEP.sign }} />
      {/* FITS THE SCREEN, NEVER SCROLLS (MESITA-4102, Pato: "optimize
          vertical space ... i should not be scrolling here"). The body, the
          panel and the QR's slot are one column that fills the height left;
          the QR takes what remains (up to 340px) instead of guessing the
          frame's height. */}
      <StepBody className="min-h-0 flex-1">
        {/* One panel (MESITA-4072): the heading inside, then the QR, centred.
            The QR's white square wears no border of its own: never a box in
            a box.
            WHAT RANKS (MESITA-4131, Pato: "Better design for this view"):
            the QR first, as large as the panel allows; under it the bill's
            total, the largest words on the screen, with the way it's paid;
            then what the signature earns and what happens if time runs out. The time left
            sits on the heading's right, where the way's chip sat. */}
        <PaySection
          title="Show your waiter"
          action={
            <span className="flex shrink-0 items-center gap-1.5 text-sm tabular-nums" role="timer" aria-live="off" data-guest-sign-timer>
              <Clock className={cn("h-4 w-4", closing ? WAIT : "text-muted-foreground")} aria-hidden />
              <span className={cn("font-semibold", closing && WAIT)}>{countdown}</span>
              <span className="text-muted-foreground">left to sign</span>
            </span>
          }
          className="flex min-h-0 flex-1 flex-col"
        >
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 p-4 pt-3 text-center">
          {/* The QR's slot takes the height left; the square is as tall as
              the slot allows, never over 340px, never under 120px (a split
              bill's parts line on a 375×553 frame needs the 20px). */}
          <div className="flex min-h-[120px] w-full flex-1 items-center justify-center">
            <div className="flex aspect-square h-full max-h-[340px] max-w-full items-center justify-center rounded-2xl bg-white">
              {qr ? (
                <QRCodeSVG value={qr} size={340} marginSize={0} style={{ width: "100%", height: "100%" }} title="Your bill's QR for the waiter" />
              ) : qrFailed ? (
                <div className="flex flex-col items-center gap-3" data-guest-sign-qr-failed>
                  <p className="text-muted-foreground text-sm" role="alert">
                    The QR didn&apos;t load.
                  </p>
                  <button
                    type="button"
                    className={cn(QUIET_BUTTON_CLASS, "w-auto")}
                    onClick={() => {
                      setQrFailed(false);
                      setQrTry((n) => n + 1);
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <Skeleton className="h-full w-full rounded-xl" />
              )}
            </div>
          </div>
          {/* The whole bill, never one part of it. One way: its words beside
              the total. A split: each part on the line under. */}
          <p className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 tabular-nums" data-guest-sign-total>
            <span className="text-2xl font-semibold">{m(total)}</span>
            {ways.length === 1 ? (
              <span className="text-muted-foreground flex items-center gap-1 text-sm [&>svg]:h-4 [&>svg]:w-4">
                {ways[0].icon}
                {ways[0].alone}
              </span>
            ) : null}
          </p>
          {ways.length > 1 ? (
            <p className="text-muted-foreground flex shrink-0 flex-wrap items-center justify-center gap-x-3 text-sm tabular-nums" data-guest-sign-parts>
              {ways.map((w) => (
                <span key={w.key} className="flex items-center gap-1 [&>svg]:h-4 [&>svg]:w-4">
                  {w.icon}
                  {m(w.cents)} {w.part}
                </span>
              ))}
            </p>
          ) : null}
          {/* The last line, honest about the end (MESITA-4130, Pato: "not
              then it's final, just then it cancels"): an unsigned bill
              expires, its card hold and credit are released, nothing is
              charged. With the reads failing, the table bill's
              "Reconnecting…" (the waiter can still scan). */}
          <p className="text-muted-foreground shrink-0 text-sm" role="status" data-guest-sign-note>
            {/* One line on a 375px phone: the longer "if not, it cancels and
                nothing is charged" wrapped and pushed the panel 20px over. */}
            {reconnecting ? "Reconnecting…" : "Not signed in time? It cancels, no charge."}
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
          <CancelBillButtons busy={busy} disabled={busy} onCancel={() => void cancel()} onKeep={() => setConfirmCancel(false)} />
        </div>
      </LocalDialog>
    </div>
  );
}
