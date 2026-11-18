import { useCallback, useEffect, useReducer } from "react";
import { type Event, type State, initialState, transition } from "./flow";

type Action = { event: Event; now: number };

function reducer(state: State, action: Action): State {
  return transition(state, action.event, action.now);
}

/** The flow, a clock tick for countdowns, and the timeout + capture timers. */
export function useFlow() {
  const [state, raw] = useReducer(reducer, undefined, () => initialState());
  const dispatch = useCallback((event: Event) => raw({ event, now: Date.now() }), []);
  const [now, tick] = useReducer(() => Date.now(), Date.now());

  const { step, deadline } = state.bill;

  useEffect(() => {
    if (step !== "sign") return;
    const id = setInterval(() => {
      tick();
      if (deadline !== null && Date.now() >= deadline) dispatch({ type: "TIMEOUT" });
    }, 250);
    return () => clearInterval(id);
  }, [step, deadline, dispatch]);

  // Card pay: the hold becomes the charge a moment after the waiter signs.
  useEffect(() => {
    if (step !== "cardPay") return;
    const id = setTimeout(() => dispatch({ type: "CAPTURE" }), 1200);
    return () => clearTimeout(id);
  }, [step, dispatch]);

  return { state, dispatch, now };
}
