import { Ticket } from "lucide-react";
import { copy } from "./copy";
import { type Event, type State, fees, upsellBlocker, upsellingOn } from "./flow";
import { VOUCHERS } from "./offer";
import { mx } from "./money";
import { Row, Toggle } from "./ui";

export function BusinessConsole({ state, dispatch }: { state: State; dispatch: (e: Event) => void }) {
  const { place, history, scenario } = state;
  const blocker = upsellBlocker(scenario);
  const set = (patch: Partial<typeof place>) => dispatch({ type: "SET_PLACE", place: { ...place, ...patch } });
  const f = fees(history);

  return (
    <section className="panel console">
      <h2 className="panel-title">{copy.app.console}</h2>
      <div className="card">
        <Toggle on={place.checkoutOn} onChange={(v) => set({ checkoutOn: v })} label={<strong>{copy.console.checkout}</strong>} />
        <p className="muted small">{copy.console.checkoutHelp}</p>
      </div>
      <div className="card">
        <Toggle
          on={upsellingOn(place, scenario)}
          disabled={blocker !== null}
          onChange={(v) => set({ upsellOn: v })}
          label={<strong>{copy.console.upsell}</strong>}
        />
        <p className="muted small">{copy.console.upsellNeeds}</p>
        {blocker ? <p className="warn small">{blocker}</p> : null}
        <p className="label">{copy.console.vouchersOffered}</p>
        {VOUCHERS.map((v) => (
          <label key={v.id} className="check">
            <input type="checkbox" checked={place.checked[v.id]} onChange={(e) => set({ checked: { ...place.checked, [v.id]: e.target.checked } })} />
            <span>
              <Ticket size={14} /> {v.name} · pay {mx(v.price)} → {mx(v.now)} + {mx(v.bonus)} bonus
            </span>
          </label>
        ))}
        <p className="muted small">{copy.console.nextBill}</p>
      </div>
      <div className="card">
        <p className="label">{copy.console.results}</p>
        <Row label={copy.console.sold} value={String(history.vouchersSold)} />
        <Row label={copy.console.moneyIn} value={history.moneyIn} />
        <Row label={copy.console.feeVouchers} value={f.vouchers} />
        <Row label={copy.console.tipsByCard} value={history.tipsByCard} />
        <Row label={copy.console.feeTips} value={f.tips} />
        <Row label={copy.console.bonusOwed} value={history.bonusOwed} />
        <Row label={copy.console.leftover} value={<span className="muted">{copy.console.notEnough}</span>} />
      </div>
      <div className="card">
        <p className="label">{copy.console.bills}</p>
        {history.bills.length === 0 ? <p className="muted small">{copy.console.noBills}</p> : null}
        {[...history.bills].reverse().slice(0, 8).map((b, i) => (
          <Row
            key={`${b.id}-${i}`}
            label={`#${b.id} · ${copy.console.outcome[b.outcome]}`}
            sub={b.payment ? `${b.payment.kind === "card" ? "card" : "cash"} ${mx(b.payment.amount)}` : "no payment"}
            value={b.amount}
          />
        ))}
      </div>
    </section>
  );
}
