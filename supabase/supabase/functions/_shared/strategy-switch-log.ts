// Structured audit log for free strategy switches (MESITA-912 T6).

import { strategyForRates, type PromoRates } from "./promo-strategy.ts";

export function logStrategySwitch(params: {
  project: string;
  from: PromoRates;
  to: PromoRates;
  actor: string;
}): void {
  const fromStrategy = strategyForRates(params.from) ?? "zero";
  const toStrategy = strategyForRates(params.to) ?? "zero";
  if (fromStrategy === toStrategy) return;

  console.log(
    JSON.stringify({
      event: "strategy_switch",
      project: params.project,
      from: fromStrategy,
      to: toStrategy,
      actor: params.actor,
    }),
  );
}
