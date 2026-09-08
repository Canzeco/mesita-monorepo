import { CreditsClient } from "./CreditsClient";

// /new-visit/wallet — Pay's second section (MESITA-1381). Reads real
// balances (MESITA-1674): consumer-web-list-credit-balances, not a browser
// emulator.
//
// Its third address and its second time at this one: /credits, /inbox/credits,
// here (2026-09-01), /wallet as a tab (09-05), back here (09-06). All three of
// the others 308 to this path.
//
// No `export const dynamic` here: new-visit/layout.tsx forces the whole Pay
// segment dynamic, and a second declaration is one more thing to keep in step.
// That layout is the RIGHT place for it — a `dynamic` on new-visit/page.tsx
// covers that page only, never this child.

export default function CreditsPage() {
  return <CreditsClient />;
}
