import { Banknote, CheckCircle2, CreditCard, HandCoins, Loader2, ScanLine, Ticket, Wallet, XCircle } from "lucide-react";
import { copy } from "./copy";
import { type Event, type State, quote } from "./flow";
import { basketLabel } from "./offer";
import { mx } from "./money";
import { Err, Phone, Row } from "./ui";

const I = { size: 18, strokeWidth: 1.75 } as const;

export function WaiterPhone({ state, dispatch }: { state: State; dispatch: (e: Event) => void }) {
  const { bill } = state;
  const q = quote(state);

  if (bill.step === "cardPay") {
    return (
      <Phone title={copy.app.waiter}>
        <div className="center stack grow">
          <Loader2 size={36} className="spin" />
          <p>{copy.waiter.capturing}</p>
        </div>
      </Phone>
    );
  }

  if (bill.step === "receipt" && bill.receipt) {
    const r = bill.receipt;
    return (
      <Phone title={copy.app.waiter} tone="green">
        <div className="center stack grow">
          <CheckCircle2 size={56} strokeWidth={1.5} className="green" />
          <p className="offer-amount">{copy.waiter.verified(r.bill)}</p>
          {r.tip && r.tipHow === "card" ? (
            <p className="pill">
              <HandCoins size={16} /> {copy.waiter.tipLanded(r.tip)}
            </p>
          ) : null}
          <p className="muted">{copy.waiter.proof}</p>
        </div>
      </Phone>
    );
  }

  if (bill.step === "notPaid") {
    return (
      <Phone title={copy.app.waiter}>
        <div className="center stack grow">
          <XCircle size={40} strokeWidth={1.5} />
          <p>{copy.waiter.rejected}</p>
        </div>
      </Phone>
    );
  }

  if (bill.step !== "sign") {
    return (
      <Phone title={copy.app.waiter}>
        <div className="center stack grow">
          <ScanLine size={40} strokeWidth={1.25} className="muted" />
          <p>{copy.waiter.idle}</p>
          <p className="muted small">{copy.waiter.idleSub}</p>
        </div>
      </Phone>
    );
  }

  if (!bill.scanned) {
    return (
      <Phone title={copy.app.waiter}>
        <div className="center stack grow">
          <ScanLine size={40} strokeWidth={1.25} />
          <button type="button" className="btn primary" onClick={() => dispatch({ type: "WAITER_SCAN" })}>
            {copy.waiter.scan}
          </button>
        </div>
      </Phone>
    );
  }

  const cash = bill.method === "cash";
  return (
    <Phone title={copy.app.waiter}>
      <div className="center">
        <p className="offer-amount">{mx(q.amount)}</p>
        <p className="muted">{copy.waiter.check}</p>
      </div>
      <div className="card">
        <Row icon={<Wallet {...I} />} label={copy.waiter.credit} value={q.totalCredit} />
        {bill.upsell === "accepted" && bill.offer ? <Row icon={<Ticket {...I} />} label={copy.sign.voucher} sub={basketLabel(bill.offer)} value={bill.offer.price} /> : null}
        {cash ? <Row icon={<Banknote {...I} />} label={copy.waiter.collect} value={q.due} strong /> : null}
        {bill.method === "card" ? <Row icon={<CreditCard {...I} />} label={copy.waiter.card} value={bill.hold ?? 0} /> : null}
        {q.tip > 0 ? <Row icon={<HandCoins {...I} />} label={copy.waiter.tip} sub={bill.method ? copy.waiter.tipHow[bill.method] : ""} value={q.tip} /> : null}
      </div>
      {cash ? (
        <label className="check">
          <input type="checkbox" checked={bill.cashChecked} onChange={(e) => dispatch({ type: "WAITER_CASH_CHECK", checked: e.target.checked })} />
          <span>{copy.waiter.received(q.due)}</span>
        </label>
      ) : null}
      <label className="field">
        <span className="label">{copy.waiter.code}</span>
        <input
          className="code"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="••••••"
          value={bill.code}
          onChange={(e) => dispatch({ type: "WAITER_CODE", text: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && dispatch({ type: "WAITER_VERIFY" })}
        />
      </label>
      <Err text={bill.waiterError} />
      <div className="actions two">
        <button type="button" className="btn" onClick={() => dispatch({ type: "WAITER_REJECT" })}>
          {copy.waiter.reject}
        </button>
        <button type="button" className="btn primary" onClick={() => dispatch({ type: "WAITER_VERIFY" })}>
          {copy.waiter.verify}
        </button>
      </div>
    </Phone>
  );
}
