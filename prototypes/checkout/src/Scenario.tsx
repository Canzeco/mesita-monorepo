import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { copy } from "./copy";
import { type Event, STEP_LABEL, type Scenario as S, type State } from "./flow";

export function Scenario({ state, dispatch }: { state: State; dispatch: (e: Event) => void }) {
  const s = state.scenario;
  const [open, setOpen] = useState(false);
  // Every change restarts the flow.
  const set = (patch: Partial<S>) => dispatch({ type: "RESTART", scenario: { ...s, ...patch } });
  const num = (v: string) => Math.max(0, Number.parseInt(v.replace(/[^0-9]/g, "") || "0", 10));

  return (
    <div className="scenario">
      <div className="scenario-bar">
        <label>
          {copy.scenario.credit}
          <input inputMode="numeric" value={s.credit} onChange={(e) => set({ credit: num(e.target.value) })} />
        </label>
        <label>
          {copy.scenario.bill}
          <input inputMode="numeric" value={s.billPrefill} onChange={(e) => set({ billPrefill: num(e.target.value) })} />
        </label>
        <label className="inline">
          <input type="checkbox" checked={s.newGuest} onChange={(e) => set({ newGuest: e.target.checked })} />
          {copy.scenario.newGuest}
        </label>
        <label>
          {copy.scenario.card}
          <select value={s.cardResult} onChange={(e) => set({ cardResult: e.target.value as S["cardResult"] })}>
            <option value="approved">{copy.scenario.approved}</option>
            <option value="declined">{copy.scenario.declined}</option>
          </select>
        </label>
        <label className="inline">
          <input type="checkbox" checked={s.vouchersModule} onChange={(e) => set({ vouchersModule: e.target.checked })} />
          {copy.scenario.vouchers}
        </label>
        <label className="inline">
          <input type="checkbox" checked={s.stripeCards} onChange={(e) => set({ stripeCards: e.target.checked })} />
          {copy.scenario.stripe}
        </label>
        <label className="inline">
          <input type="checkbox" checked={s.fastTimer} onChange={(e) => set({ fastTimer: e.target.checked })} />
          {copy.scenario.fastTimer}
        </label>
        <button type="button" className="btn small" onClick={() => set({})}>
          <RotateCcw size={14} /> {copy.scenario.restart}
        </button>
        <span className="step-label">
          {copy.scenario.step}: <strong>{STEP_LABEL[state.bill.step]}</strong>
        </span>
        <button type="button" className="link" onClick={() => setOpen(!open)}>
          {copy.scenario.tryTitle}
        </button>
      </div>
      {open ? (
        <ol className="try">
          {copy.scenario.tryList.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
