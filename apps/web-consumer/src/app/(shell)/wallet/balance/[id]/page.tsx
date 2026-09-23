import { BalanceClient } from "./BalanceClient";

// /wallet/balance/[id] — one place's Credits, opened
// (MESITA-1674 made `id` a real ledger id rather than an emulator key;
// MESITA-1892 made that id a PLACE id, the organization having been removed).
//
// It was a `LocalSheet` at 80% until 2026-09-08 (reversing an earlier reading
// of "que se abra de abajo para arriba" — that instruction was about the
// card's open gesture, not about the surface being a sheet forever). A
// statement with its own terms and its own activity list is a destination:
// you can be sent to it, land on it cold, and press Back out of it.
//
// `balance/[id]` rather than a bare `[id]` under wallet/ — see
// wallet.balance in the route contract.
//
// The id is NOT trusted: it is whatever is in the URL, and BalanceClient
// resolves it against the real list, saying plainly when it resolves to
// nothing.

export default async function BalancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BalanceClient placeId={id} />;
}
