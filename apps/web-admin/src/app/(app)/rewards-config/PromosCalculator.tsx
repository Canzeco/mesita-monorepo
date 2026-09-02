"use client";

import { ResolvedLedger } from "./ResolvedLedger";
import { usePromosState } from "./PromosState";

// Last block on Rewards Config. The knobs never print a sum; this is the
// calculator — pick a guest, watch the visit bill add up.
export function PromosCalculator() {
  const { cfg } = usePromosState();
  return <ResolvedLedger cfg={cfg} />;
}
