"use client";

import { useEffect, useState } from "react";
import { Banknote, CircleCheck, Clock, Coins, HandCoins, Loader2, Smartphone, Wallet, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { SizedImg } from "@mesita/place-profile";
import { clockTime } from "@mesita/place-profile/lib/money";
import { Button } from "@/components/ui/button";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiCancelTab, apiGetTab, type GuestTab, runBankCheck, TAB_REFUSAL, type TabCardStep } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { clearGuestDraft, reopenGuestDraft } from "./GuestPayScreen";
import { BAD, GOOD, GOOD_TINT, MoneyRow, NOT_PAID_REASON, RowsCard, StepsBar, WAIT } from "./pay-flow";
import { forgetGuestTab, NETWORK_FAILURE, QUIET_BUTTON_CLASS, readGuestQr, rememberGuestTab } from "./pay-common";

// THE GUEST'S BILL (MESITA-3861, Pato's "14. Payments Flow Guest-Lead"), at
// /pay/tab/<id>, after App Pay, "I gave the cash" or credits alone:
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
      reopenGuestDraft(tab.place.id);
      onPayAgain(tab.place.id);
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
    return (
      <div className="-mx-4 -mt-4 flex min-h-0 flex-1 flex-col" data-guest-tab="receipt">
        <div className="flex shrink-0 flex-col items-center bg-green-700 px-4 pt-8 pb-6 text-white">
          <CircleCheck className="h-14 w-14" aria-hidden />
          <h2 className="font-display mt-3 text-xl font-semibold">Paid</h2>
          <p className="text-sm text-white/85">{clockTime(tab.verified_at ?? tab.paid_at ?? tab.updated_at)}</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
          <div className="flex shrink-0 items-center gap-3">
            <span className="bg-muted h-10 w-10 shrink-0 overflow-hidden rounded-full" aria-hidden>
              {place?.photo ? <SizedImg src={place.photo} size="thumb" alt="" className="h-full w-full object-cover" /> : null}
            </span>
            <span className="min-w-0 flex-1 truncate text-base font-semibold">{placeName}</span>
          </div>
          <RowsCard className="mt-4 shrink-0">
            {tab.credit_cents > 0 ? <MoneyRow icon={<Wallet />} label="Credits" value={m(tab.credit_cents)} /> : null}
            {tab.card_bill_cents > 0 ? <MoneyRow icon={<Smartphone />} label="Card" value={m(tab.card_bill_cents)} /> : null}
            {tab.cash_bill_cents > 0 ? <MoneyRow icon={<Banknote />} label="Cash" value={m(tab.cash_bill_cents)} /> : null}
            {tip > 0 ? <MoneyRow icon={<HandCoins />} label="Tip" value={m(tip)} /> : null}
            <MoneyRow label="Total" value={m(total)} strong />
            <MoneyRow label="Signed by staff" value="" />
          </RowsCard>
          {back > 0 ? (
            <div className={cn("mt-4 flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 font-semibold", GOOD, GOOD_TINT)} data-guest-cashback>
              <Coins className="h-5 w-5 shrink-0" aria-hidden />
              <span className="flex-1">+{m(back)} back here</span>
              <span className="flex items-center gap-1 text-sm">
                <Clock className="h-4 w-4" aria-hidden />
                in 1 hr
              </span>
            </div>
          ) : (
            <div className="border-border text-muted-foreground mt-4 flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3" data-guest-cashback>
              <Coins className="h-5 w-5 shrink-0" aria-hidden />
              <span>{card + cash === 0 ? "No cashback on credits" : "No cashback"}</span>
            </div>
          )}
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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <XCircle className={cn("h-14 w-14", BAD)} aria-hidden />
          <h2 className="font-display mt-4 text-xl font-semibold">Not paid</h2>
          <p className="mt-2 text-base">{reason}</p>
          <p className="text-muted-foreground mt-1 max-w-xs text-sm">
            {cash > 0 ? "Nothing was charged in Mesita. If you gave cash, settle it with the waiter." : "Nothing was charged"}
          </p>
        </div>
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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center" role="status">
          <Loader2 className="h-14 w-14 animate-spin motion-reduce:animate-none" aria-hidden />
          <h2 className="font-display mt-4 text-xl font-semibold">Confirming…</h2>
        </div>
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
      <h2 className="font-display flex h-11 shrink-0 items-center truncate text-xl font-semibold">Show this QR to your waiter</h2>
      <StepsBar at={4} className="mt-1" />
      <p className="mt-2 flex shrink-0 justify-center">
        <span className="border-border flex items-center gap-2 rounded-full border px-3 py-1 text-base font-semibold tabular-nums [&>svg]:h-5 [&>svg]:w-5">
          {wayIcon}
          {wayWords}
        </span>
      </p>
      <div className="mt-4 flex min-h-0 flex-1 items-center justify-center [container-type:size]">
        {qr ? (
          <div
            className="border-border rounded-2xl border bg-white p-3"
            style={{ width: "max(160px, min(100cqh, 100cqw, 320px))", height: "max(160px, min(100cqh, 100cqw, 320px))" }}
          >
            <QRCodeSVG value={qr} size={320} marginSize={0} style={{ width: "100%", height: "100%" }} title="Your bill's QR for the waiter" />
          </div>
        ) : (
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" aria-label="Loading the QR" />
        )}
      </div>
      <p className={cn("mt-4 flex shrink-0 items-center justify-center gap-2 text-base font-semibold tabular-nums", WAIT)} role="timer" aria-live="off">
        <Clock className="h-5 w-5" aria-hidden />
        {countdown}
        <span className="text-muted-foreground font-normal">to sign</span>
      </p>
      <p className="text-muted-foreground mt-1 shrink-0 text-center text-sm">Once the waiter signs, this payment is final.</p>
      {error ? (
        <p className="text-destructive mt-1 shrink-0 text-center text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setConfirmCancel(true)}
        className={cn("mx-auto flex h-11 shrink-0 items-center px-3 text-sm font-semibold", BAD)}
        data-guest-cancel-bill
      >
        Cancel bill
      </button>
      {tab.test_mode && qr ? (
        <a href={qr} target="_blank" rel="noopener noreferrer" className="text-muted-foreground mx-auto flex h-9 shrink-0 items-center text-xs font-semibold underline" data-open-as-waiter>
          Open as waiter (test)
        </a>
      ) : null}

      <LocalDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} ariaLabel="Cancel this bill">
        <div className="p-5">
          <p className="text-base font-semibold">Cancel this bill?</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {card > 0 ? "The card hold is released. " : ""}
            {tab.credit_cents > 0 ? "No credits are spent. " : ""}
            Everything you typed stays.
          </p>
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
