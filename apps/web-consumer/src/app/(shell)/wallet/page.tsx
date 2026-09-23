import { CreditsClient } from "./CreditsClient";

// /wallet — the Wallet tab (MESITA-2050). Reads real balances (MESITA-1674):
// consumer-web-list-credit-balances, not a browser emulator.
//
// Its fourth address and its second time at this one: /credits,
// /inbox/credits, /new-visit/wallet (2026-09-01), /wallet as a tab (09-05),
// /new-visit/wallet again (09-06), and /wallet as a tab again. Every one of
// the others 308s here in one hop.
//
// No `export const dynamic` here: wallet/layout.tsx forces the whole tab
// dynamic, and a second declaration is one more thing to keep in step.

export default function CreditsPage() {
  return <CreditsClient />;
}
