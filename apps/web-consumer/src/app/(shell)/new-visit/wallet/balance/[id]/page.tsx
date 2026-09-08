import { BalanceClient } from "./BalanceClient";
import { parseCreditsDemo } from "@/lib/credits-demo";

// /new-visit/wallet/balance/[id] — one balance, opened.
//
// It was a `LocalSheet` at 80% until today (Pato, 2026-09-08, reversing an
// earlier reading of "que se abra de abajo para arriba" — that instruction was
// about the card's open gesture, not about the surface being a sheet forever).
// A statement with its own terms and its own activity list is a destination:
// you can be sent to it, land on it cold, and press Back out of it.
//
// `balance/[id]` rather than a bare `[id]` under wallet/ — see
// newVisit.walletBalance in the route contract.
//
// The id is NOT trusted: it is whatever is in the URL, and the emulator's
// balances live in localStorage, so the client resolves it and says plainly
// when it resolves to nothing.

export default async function BalancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <BalanceClient balanceId={id} seed={parseCreditsDemo(sp)} />;
}
