import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  HandCoins,
  Loader2,
  MapPin,
  QrCode,
  Ticket,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { copy } from "./copy";
import { type Event, PLACE, type State, type TipKind, cardAvailable, cashAvailable, quote } from "./flow";
import { basketLabel } from "./offer";
import { mx } from "./money";
import { Err, Phone, Row, Toggle } from "./ui";

type Props = { state: State; dispatch: (e: Event) => void; now: number };

const I = { size: 18, strokeWidth: 1.75 } as const;

function Header({ onBack }: { onBack?: () => void }) {
  return (
    <header className="place">
      {onBack ? (
        <button type="button" className="icon-btn" aria-label={copy.icons.back} onClick={onBack}>
          <ArrowLeft {...I} />
        </button>
      ) : null}
      <div className="place-photo" aria-hidden />
      <button type="button" className="place-name" title={copy.pick.change}>
        <strong>{PLACE.name}</strong>
        <span className="muted">
          <MapPin size={13} /> {PLACE.distance}
        </span>
      </button>
    </header>
  );
}

function Summary({ state }: { state: State }) {
  const q = quote(state);
  return (
    <div className="card">
      <Row label={copy.bill.bill} value={q.amount} />
      <Row icon={<Wallet {...I} />} label={copy.bill.creditApplied} value={q.creditApplied ? `−${mx(q.creditApplied)}` : mx(0)} />
      <Row label={copy.bill.left} value={q.shortfall} strong />
    </div>
  );
}

export function GuestPhone({ state, dispatch, now }: Props) {
  const { bill, wallet } = state;
  const q = quote(state);
  const back = () => dispatch({ type: "BACK" });

  if (!bill.settings.checkoutOn) {
    return (
      <Phone title={copy.app.guest}>
        <Header />
        <p className="notice">{copy.pick.off}</p>
      </Phone>
    );
  }

  switch (bill.step) {
    case "pick":
      return (
        <Phone title={copy.app.guest}>
          <div className="pick">
            <div className="place-photo big" aria-hidden />
            <button type="button" className="pick-name" title={copy.pick.change}>
              {PLACE.name}
            </button>
            <p className="muted">
              <MapPin size={14} /> {PLACE.distance} · {copy.pick.change}
            </p>
            <p className="pill">
              <Wallet size={16} /> {copy.pick.credit(wallet.credit)}
            </p>
          </div>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => dispatch({ type: "START" })}>
              {copy.pick.start}
            </button>
          </div>
        </Phone>
      );

    case "bill":
      return (
        <Phone title={copy.app.guest}>
          <Header onBack={back} />
          <label className="field">
            <span className="label">{copy.bill.title}</span>
            <span className="big-input">
              <span>MX$</span>
              <input
                inputMode="numeric"
                autoFocus
                value={bill.amountText}
                placeholder="0"
                onChange={(e) => dispatch({ type: "SET_AMOUNT", text: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && dispatch({ type: "BILL_NEXT" })}
              />
            </span>
            <Err text={bill.amountError} />
          </label>
          <Toggle on={bill.useCredit} onChange={() => dispatch({ type: "TOGGLE_CREDIT" })} label={<><Wallet {...I} /> {copy.bill.useCredit(wallet.credit)}</>} />
          <Summary state={state} />
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => dispatch({ type: "BILL_NEXT" })}>
              {copy.bill.next}
            </button>
          </div>
        </Phone>
      );

    case "tip": {
      const opts: [TipKind, string][] = [
        ["none", copy.tip.none],
        ["10", copy.tip.ten],
        ["15", copy.tip.fifteen],
        ["other", copy.tip.other],
      ];
      return (
        <Phone title={copy.app.guest}>
          <Header onBack={back} />
          <h3 className="h">
            <HandCoins {...I} /> {copy.tip.title}
          </h3>
          <div className="segmented">
            {opts.map(([k, label]) => (
              <button key={k} type="button" className={bill.tipKind === k ? "is-on" : ""} onClick={() => dispatch({ type: "SET_TIP", kind: k })}>
                {label}
              </button>
            ))}
          </div>
          {bill.tipKind === "other" ? (
            <label className="field">
              <span className="big-input small">
                <span>MX$</span>
                <input inputMode="numeric" autoFocus placeholder={copy.tip.otherPlaceholder} value={bill.tipOther} onChange={(e) => dispatch({ type: "SET_TIP_OTHER", text: e.target.value })} />
              </span>
            </label>
          ) : null}
          <Err text={bill.tipError} />
          <p className="muted small">{copy.tip.note}</p>
          <div className="card">
            <Row label={copy.bill.left} value={q.shortfall} />
            <Row icon={<HandCoins {...I} />} label={copy.tip.title} value={q.tip} />
            <Row label={copy.tip.total} value={q.shortfall + q.tip} strong />
          </div>
          {q.shortfall === 0 && q.tip > 0 ? <p className="muted small">{copy.tip.coveredByCredit}</p> : null}
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => dispatch({ type: "TIP_NEXT" })}>
              {copy.tip.next}
            </button>
          </div>
        </Phone>
      );
    }

    case "upsell": {
      const o = bill.offer!;
      const leftover = wallet.credit - q.creditApplied + o.now - q.shortfall;
      return (
        <Phone title={copy.app.guest}>
          <Header onBack={back} />
          <div className="offer">
            <h3 className="h">
              <Ticket {...I} /> {copy.upsell.title}
            </h3>
            <p className="offer-amount">{mx(o.charge)}</p>
            <p>{copy.upsell.body(basketLabel(o), leftover, o.bonus)}</p>
            <div className="card">
              <Row icon={<Ticket {...I} />} label={copy.upsell.lines.vouchers} sub={basketLabel(o)} value={o.price} />
              <Row icon={<HandCoins {...I} />} label={copy.upsell.lines.tip} value={q.tip} />
              <Row label={copy.upsell.lines.total} value={o.charge} strong />
            </div>
          </div>
          <div className="actions two">
            <button type="button" className="btn primary" onClick={() => dispatch({ type: "UPSELL_BUY" })}>
              {copy.upsell.buy(o.charge)}
            </button>
            <button type="button" className="btn primary alt" onClick={() => dispatch({ type: "UPSELL_SKIP" })}>
              {copy.upsell.skip}
            </button>
          </div>
          <p className="muted small center">{copy.upsell.once}</p>
        </Phone>
      );
    }

    case "method": {
      const voucher = bill.upsell === "accepted" && bill.offer;
      const what = voucher ? copy.method.forVoucher(basketLabel(bill.offer!)) : q.shortfall === 0 ? copy.method.forTip : copy.method.forRest;
      const card = cardAvailable(state);
      const cash = cashAvailable(state);
      return (
        <Phone title={copy.app.guest}>
          <Header onBack={back} />
          <h3 className="h">{copy.method.title}</h3>
          <p className="offer-amount">{mx(q.due)}</p>
          <p className="muted">{what}</p>
          <div className="choices">
            <button type="button" disabled={!card} className={`choice${bill.method === "card" ? " is-on" : ""}`} onClick={() => dispatch({ type: "CHOOSE_METHOD", method: "card" })}>
              <CreditCard {...I} />
              <span>
                <strong>{copy.method.card}</strong>
                <span className="muted small">{card ? copy.method.cardSub : copy.method.noCard}</span>
              </span>
            </button>
            <button type="button" disabled={!cash} className={`choice${bill.method === "cash" ? " is-on" : ""}`} onClick={() => dispatch({ type: "CHOOSE_METHOD", method: "cash" })}>
              <Banknote {...I} />
              <span>
                <strong>{copy.method.cash}</strong>
                <span className="muted small">{cash ? copy.method.cashSub : copy.method.noCashVoucher}</span>
              </span>
            </button>
          </div>
          {bill.method === "card" ? <p className="muted small">{copy.method.cardHold}</p> : null}
          <Err text={bill.methodError} />
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => dispatch({ type: "METHOD_NEXT" })}>
              {copy.method.next(q.due, bill.method === "card")}
            </button>
            {voucher && bill.methodError ? (
              <button type="button" className="btn" onClick={() => dispatch({ type: "DROP_VOUCHER" })}>
                {copy.method.dropVoucher}
              </button>
            ) : null}
          </div>
        </Phone>
      );
    }

    case "cashPay":
      return (
        <Phone title={copy.app.guest}>
          <Header onBack={back} />
          <div className="center stack">
            <Banknote size={40} strokeWidth={1.5} />
            <p className="offer-amount">{copy.cashPay.give(q.due)}</p>
            <p className="muted">{copy.cashPay.sub}</p>
          </div>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => dispatch({ type: "CASH_PAID" })}>
              {copy.cashPay.paid}
            </button>
          </div>
        </Phone>
      );

    case "sign": {
      const left = Math.max(0, Math.ceil(((bill.deadline ?? now) - now) / 1000));
      return (
        <Phone title={copy.app.guest}>
          <div className="sign-top">
            <h3 className="h">{copy.sign.title}</h3>
            <button type="button" className="icon-btn" aria-label={copy.sign.cancel} onClick={() => dispatch({ type: "CANCEL" })}>
              <X {...I} />
            </button>
          </div>
          <div className="qr" aria-label="QR">
            <QrCode size={150} strokeWidth={1} />
            <strong>{PLACE.name}</strong>
          </div>
          <p className="amber">
            <Clock size={16} /> {copy.sign.countdown(left)}
          </p>
          <div className="card">
            <Row label={copy.bill.bill} value={q.amount} strong />
            <Row icon={<Wallet {...I} />} label={copy.sign.credit} value={q.totalCredit} />
            {bill.upsell === "accepted" && bill.offer ? <Row icon={<Ticket {...I} />} label={copy.sign.voucher} sub={basketLabel(bill.offer)} value={bill.offer.price} /> : null}
            {bill.method === "cash" ? <Row icon={<Banknote {...I} />} label={copy.sign.atTable} value={q.due} /> : null}
            {bill.method === "card" ? <Row icon={<CreditCard {...I} />} label={copy.sign.card} value={bill.hold ?? 0} /> : null}
            {q.tip > 0 ? <Row icon={<HandCoins {...I} />} label={copy.sign.tip} sub={bill.method ? copy.receipt.tipHow[bill.method] : ""} value={q.tip} /> : null}
          </div>
          <p className="muted small">{copy.sign.final}</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => dispatch({ type: "CANCEL" })}>
              {copy.sign.cancel}
            </button>
          </div>
        </Phone>
      );
    }

    case "cardPay":
      return (
        <Phone title={copy.app.guest}>
          <div className="center stack grow">
            <Loader2 size={36} className="spin" />
            <h3 className="h">{copy.cardPay.title}</h3>
            <p className="muted">{copy.cardPay.sub(bill.hold ?? 0)}</p>
          </div>
        </Phone>
      );

    case "receipt": {
      const r = bill.receipt!;
      return (
        <Phone title={copy.app.guest} tone="green">
          <div className="center stack">
            <CheckCircle2 size={44} strokeWidth={1.5} className="green" />
            <h3 className="h">{copy.receipt.title}</h3>
            <p className="offer-amount">{mx(r.bill)}</p>
          </div>
          <div className="card">
            <Row label={copy.receipt.bill} value={r.bill} />
            <Row icon={<Wallet {...I} />} label={copy.receipt.creditUsed} value={r.creditUsed} />
            {r.voucher ? <Row icon={<Ticket {...I} />} label={copy.receipt.voucher(r.voucher.label)} value={r.voucher.price} /> : null}
            {r.paidByCard ? <Row icon={<CreditCard {...I} />} label={copy.receipt.card} value={r.paidByCard} /> : null}
            {r.paidAtTable ? <Row icon={<Banknote {...I} />} label={copy.receipt.table} value={r.paidAtTable} /> : null}
            {r.tip ? <Row icon={<HandCoins {...I} />} label={copy.receipt.tip} sub={r.tipHow ? copy.receipt.tipHow[r.tipHow] : ""} value={r.tip} /> : null}
            <Row label={copy.receipt.creditLeft} value={r.creditLeft} strong />
            {r.pendingBonus ? <Row icon={<Clock {...I} />} label={copy.receipt.pending} sub={copy.receipt.in3h} value={r.pendingBonus} /> : null}
          </div>
          <p className="muted small">{copy.receipt.saved}</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => dispatch({ type: "DONE" })}>
              {copy.receipt.done}
            </button>
          </div>
        </Phone>
      );
    }

    case "notPaid":
      return (
        <Phone title={copy.app.guest}>
          <div className="center stack">
            <XCircle size={44} strokeWidth={1.5} />
            <h3 className="h">{copy.notPaid.title}</h3>
            <p>{copy.notPaid[bill.notPaidReason ?? "cancelled"]}</p>
          </div>
          <div className="card">
            <p className="row-line">
              <Wallet {...I} /> {copy.notPaid.noCredit}
            </p>
            {bill.method === "card" ? (
              <p className="row-line">
                <CreditCard {...I} /> {copy.notPaid.noCharge}
              </p>
            ) : null}
          </div>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => dispatch({ type: "START_AGAIN" })}>
              {copy.notPaid.again}
            </button>
          </div>
        </Phone>
      );
  }
}
