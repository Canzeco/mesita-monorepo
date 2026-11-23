"use client";

import { useEffect, useState } from "react";
import { Banknote, CircleCheck, HandCoins, Loader2, PenLine, Wallet, XCircle } from "lucide-react";
import { Skeleton } from "@/components/shared/Skeleton";
import { QRCodeSVG } from "qrcode.react";
import { SizedImg } from "@mesita/place-profile";
import { Button } from "@/components/ui/button";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiCancelTab, apiGetTab, type GuestTab, TAB_REFUSAL } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { useWakeLock } from "@/lib/use-wake-lock";
import { clearGuestDraft, reopenGuestDraft } from "@/lib/guest-pay-draft";
import { trackEvent } from "@/lib/analytics/track";
import { BAD, GOOD, MoneyRow, NOT_PAID_REASON, PaySection, PayTitle, StepBody, StepFooter, StepStrip, WAIT } from "./pay-flow";
import { forgetGuestTab, NETWORK_FAILURE, QUIET_BUTTON_CLASS, readGuestQr, rememberGuestTab, CancelBillButtons } from "./pay-common";

// THE GUEST'S BILL (MESITA-3861, Pato's "14. Payments Flow Guest-Lead"), at
// /pay/bill/<id>, after "I gave the cash" or credits alone (MESITA-4708: no
// card part, so no hold, bank check or card decline here):
//
//   6 Pay the waiter  three numbered steps (MESITA-4654): 1 Waiter scans
//                 this (the QR, the total, the part not in cash), 2 Hand over
//                 cash (the green box, only with cash), 3 Waiter confirms (the
//                 time left). Nothing is editable; Cancel bill ends the
//                 ticket. The screen stays on.
//   Confirming    a Loader and "Confirming…" while the waiter's Confirm
//                 runs.
//   7 Receipt     the step panel, a green Paid with the total, the lines
//                 with their icons, "Confirmed by staff" ✓; Done.
//   Not paid      a red XCircle, one line why, "Nothing was paid" (never on
//                 cash), New ticket (MESITA-4524: the old ticket is done). Was Start
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
  registerBack,
}: {
  tab: GuestTab;
  /** The place's photo, from the Pay list (null while it loads). */
  place: PayPlace | null;
  getSupabase: () => Parameters<typeof apiGetTab>[0];
  /** Back to the bill at this place, everything typed. */
  onPayAgain: (placeId: string) => void;
  onDone: () => void;
  /** The header's X (MESITA-3880): on Confirm it closes; the bill keeps waiting (MESITA-3908). */
  registerClose?: (close: (() => void) | null) => void;
  /** The header's ← (MESITA-4618): while the bill waits, back to Method. */
  registerBack?: (back: (() => boolean) | null) => void;
}) {
  const [tab, setTab] = useState(first);
  const [qr, setQr] = useState<string | null>(() => readGuestQr(first.tab_id));
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
  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const tip = tab.cash_tip_cents;
  const total = tab.credit_cents + cash;
  const signed = tab.status === "paid" && !!tab.verified_at;
  const ended = tab.status === "cancelled" || tab.status === "expired";
  useEffect(() => {
    if (ended) return;
    trackEvent(getSupabase(), "pay_step_view", { step: signed ? "receipt" : "sign" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signed, ended]);
  const confirming = !signed && !ended && tab.signing === true;
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

  // Confirm only: the header's X asks to cancel; the other states keep Back.
  const signing = !done && !confirming;
  // The phone must not lock while the guest waits for the waiter (MESITA-4131).
  useWakeLock(signing);
  // NO ZOMBIE BILLS (Pato, 2026-11-21, MESITA-4609: "if i press the X, ask if
  // cancel bill. thats it. If you close the ticket, the ticket is gone"):
  // while the bill waits for the waiter, ✕ asks "Cancel this bill?" (Cancel
  // cancels it on the server and closes; Keep stays). Once it is done (paid,
  // cancelled, expired) ✕ just closes, and so does it while the waiter is
  // signing (money moving, no cancel; it resolves in seconds). It closed and
  // left the bill waiting before (MESITA-4600, MESITA-3908).
  const waiting = signing;
  useEffect(() => {
    if (!registerClose) return;
    registerClose(waiting ? () => setConfirmCancel(true) : onDone);
    return () => registerClose(null);
  }, [registerClose, onDone, waiting]);

  useEffect(() => {
    if (!done) return;
    forgetGuestTab(tab.tab_id);
    if (signed) clearGuestDraft(tab.place.id);
  }, [done, signed, tab.tab_id, tab.place.id]);

  // ← BACK TO METHOD, A NEW TICKET (Pato, 2026-11-21, MESITA-4618: "when
  // creating ticket to pay, enable to return and just create other id for
  // the ticket"): while the bill waits for the waiter, ← cancels it on the
  // server (nothing paid, the credit released) and reopens "How do you
  // pay?" with the bill and tip still typed; Pay again makes a new ticket.
  async function backToMethod() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiCancelTab(getSupabase(), tab.tab_id, "cancel");
      forgetGuestTab(tab.tab_id);
      reopenGuestDraft(tab.place.id, "method");
      onPayAgain(tab.place.id);
    } catch (e) {
      const code = e instanceof EFError ? e.code : null;
      setError((code && TAB_REFUSAL[code]) || NETWORK_FAILURE);
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!registerBack) return;
    if (!signing) {
      registerBack(null);
      return;
    }
    registerBack(() => {
      void backToMethod();
      return true;
    });
    return () => registerBack(null);
    // backToMethod reads the latest tab each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerBack, signing, tab.tab_id]);

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

  // 7 RECEIPT (MESITA-4135, Pato: "a better design when the tickets are gone
  // ... keep the structure"). The same three
  // parts as before, green Paid, one panel of rows, Done, now under the step
  // panel ("Receipt · 6 of 6", the sixth segment shown only here): Paid carries the total, Signed by staff
  // carries its check, and the footer is Done.
  if (signed) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-guest-tab="receipt">
        <PayTitle title="Receipt" />
        <StepBody className="min-h-0 flex-1">
          {/* Paid, one green row with the total (it was a full-bleed band
              140px tall; under the step panel the rows and the gift must
              still fit a small phone). No time once signed (MESITA-4133). */}
          <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-green-700 px-4 py-3 text-left text-white" data-guest-paid>
            <CircleCheck className="h-8 w-8 shrink-0" aria-hidden />
            <h2 className="flex-1 text-xl font-semibold">Paid</h2>
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
            {tab.cash_bill_cents > 0 ? <MoneyRow icon={<Banknote />} label="Cash" value={m(tab.cash_bill_cents)} /> : null}
            {tip > 0 ? <MoneyRow icon={<HandCoins />} label="Tip" value={m(tip)} /> : null}
            <MoneyRow label="Total" value={m(total)} strong />
            <MoneyRow
              icon={<PenLine />}
              label="Confirmed by staff"
              value={<CircleCheck className={cn("h-5 w-5", GOOD)} aria-label="Confirmed" />}
            />
          </PaySection>
        </StepBody>
        {/* The footer, always in reach. */}
        <div className="border-border -mx-4 mt-3 grid shrink-0 gap-3 border-t px-4 pt-3">
          <StepStrip at="done" />
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
      (tab.status === "expired" ? NOT_PAID_REASON.expired : NOT_PAID_REASON.cancelled);
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-guest-tab="not-paid">
        <PayTitle title="Not paid" />
        <StepBody>
          <PaySection className="flex flex-col items-center p-4 text-center">
            <XCircle className={cn("h-10 w-10", BAD)} aria-hidden />
            <p className="mt-2 text-base">{reason}</p>
            <p className="text-muted-foreground mt-1 max-w-xs text-sm">
              {/* MESITA-4524: never "Nothing was charged" on cash the guest may have handed over. */}
              {cash > 0
                ? "The waiter didn't confirm your cash. If you handed it over, show this screen to the staff."
                : "Nothing was paid"}
            </p>
          </PaySection>
        </StepBody>
        <Button
          size="lg"
          className="min-h-12 w-full shrink-0 text-base font-semibold"
          onClick={() => {
            // MESITA-4524: a ticket that did not pay is done; this starts a
            // NEW ticket at an empty Bill.
            clearGuestDraft(tab.place.id);
            onPayAgain(tab.place.id);
          }}
        >
          New ticket
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
        <PayTitle title="Confirming…" />
        <StepBody>
          <PaySection className="flex flex-col items-center p-4 text-center" data-guest-confirming>
            <div role="status" className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 animate-spin motion-reduce:animate-none" aria-hidden />
              <h2 className="mt-2 text-xl font-semibold">Confirming…</h2>
              {/* MESITA-4524: past 20 s the guest may leave; the ticket still ends on its own. */}
              {tab.signing && now - Date.parse(tab.updated_at) > 20_000 ? (
                <p className="text-muted-foreground mt-2 max-w-xs text-sm">
                  This is taking longer than usual. You can go; your receipt will appear in Tickets.
                </p>
              ) : null}
            </div>
          </PaySection>
        </StepBody>
        <StepFooter strip={3} />
      </div>
    );
  }

  // 5 PAY THE WAITER (MESITA-4654, Pato: "make this clearer … one box for qr.
  // one green box for cash … waiter confirms receive … money on bottom and
  // qr on top"): three numbered steps in the order they happen.
  //   1 Waiter scans this   the QR, the bill's total, the part not in cash.
  //   2 Hand over cash      only with a cash part: the Link-green box.
  //   3 Waiter confirms     a quiet row: waiting, the time left.
  // Without cash the confirm row is step 2 and the QR takes the room.
  const secs = Math.max(0, Math.ceil(leftMs / 1000));
  const countdown = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  // Amber only when the time is nearly out: it read as an alarm with most of
  // an hour left (MESITA-4131).
  const closing = secs <= 120;
  const reconnecting = failedReads >= 2;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-guest-tab="sign">
      {/* MESITA-4061: the same frame as every guest step. */}
      <PayTitle title="Pay the waiter" back={!busy} />
      {/* FITS THE SCREEN, NEVER SCROLLS (MESITA-4102): the QR's slot takes
          the height left (up to 340px, never under 80px: a cash bill on a
          375×553 phone, Safari's bars on, needs the room, MESITA-4658). */}
      <StepBody className="min-h-0 flex-1">
        <PaySection className="flex min-h-0 flex-1 flex-col" data-guest-sign-qr-step>
          <div className="flex min-h-0 flex-1 flex-col items-center gap-1 p-3 text-center">
            {/* CLEARER (Pato, 2026-11-22, MESITA-4660: "make this clearer"):
                one instruction, the amount first, then the QR; no numbers of
                its own inside the ticket's strip. */}
            <h2 className="w-full shrink-0 text-center text-base font-semibold">Show this to your waiter</h2>
            {/* The whole bill, never one part of it. */}
            <p className="shrink-0 text-2xl font-semibold tabular-nums" data-guest-sign-total>
              {m(total)}
            </p>
            {/* The part not in cash, under the total: the cash has its own step. */}
            {tab.credit_cents > 0 ? (
              <p className="text-muted-foreground shrink-0 text-sm tabular-nums" data-guest-sign-parts>
                {m(tab.credit_cents)} from your credits
              </p>
            ) : null}
            <div className="flex min-h-[80px] w-full flex-1 items-center justify-center">
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
        {/* 2 HAND OVER CASH (MESITA-4618's Link green): one row, the step
            on the left, the amount large on the right. Never half the screen:
            as a half it left the QR its 120px floor and cut the total off a
            667px phone (MESITA-4658); the QR is step 1 and takes the room. */}
        {cash > 0 ? (
          <section
            className="flex shrink-0 items-center gap-3 rounded-2xl bg-[#00D66F] px-4 py-3 text-neutral-950"
            aria-label={`Give the waiter ${m(cash)} in cash`}
            data-guest-sign-cash
          >
            <span className="min-w-0 flex-1 whitespace-nowrap">
              <span className="text-base font-semibold">Give the waiter cash</span>
            </span>
            <span className="shrink-0 text-3xl font-semibold tabular-nums">{m(cash)}</span>
          </section>
        ) : null}
        {/* LAST: THE WAITER CONFIRMS (MESITA-4521: Confirm, never Sign). The
            time left lives here; an unconfirmed bill cancels with nothing
            charged. Reads failing twice: "Reconnecting…". */}
        <p className="text-muted-foreground flex shrink-0 items-center justify-center gap-2 py-1 text-sm tabular-nums" aria-label="The waiter confirms" data-guest-sign-confirm>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
          <span role="timer" aria-live="off" data-guest-sign-timer>
            {reconnecting ? (
              "Reconnecting…"
            ) : (
              <>
                Waiting for the waiter to confirm · <span className={cn("font-semibold", closing && WAIT)}>{countdown}</span>
              </>
            )}
          </span>
        </p>
      </StepBody>
      <StepFooter strip={3} onCancel={() => setConfirmCancel(true)} cancelDisabled={busy} />

      <LocalDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} ariaLabel="Cancel this bill">
        <div className="p-5">
          <p className="text-base font-semibold">Cancel this bill?</p>
          {/* WHAT COMES BACK, PART BY PART (MESITA-4106, Pato: "mention that
              you can get your credits back, but that if you paid with money
              ... your money is gone"). Cancel (consumer-web-cancel-tab mode
              "cancel") spends no credit; cash already in the waiter's hand is
              outside Mesita, the one loss. */}
          <ul className="mt-2 flex flex-col gap-1.5 text-sm" data-guest-cancel-parts>
            {tab.credit_cents > 0 ? (
              <li className="text-muted-foreground">Your {m(tab.credit_cents)} of credits stay in your Wallet.</li>
            ) : null}
            {cash > 0 ? (
              <li className="text-destructive font-semibold">
                Cash you already gave the waiter ({m(cash)}) is not returned by Mesita. Ask the place for it.
              </li>
            ) : null}
            {tab.credit_cents === 0 && cash === 0 ? <li className="text-muted-foreground">Nothing is paid.</li> : null}
          </ul>
          <CancelBillButtons busy={busy} disabled={busy} onCancel={() => void cancel()} onKeep={() => setConfirmCancel(false)} />
        </div>
      </LocalDialog>
    </div>
  );
}

