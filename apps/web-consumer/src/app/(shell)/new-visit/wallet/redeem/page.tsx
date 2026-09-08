import { RedeemClient } from "./RedeemClient";

// /new-visit/wallet/redeem — claim gifted Credits with a ten-digit code.
// PARKED (MESITA-1674): see RedeemClient.tsx — Gift has no real backend to
// issue a code from yet (MESITA-1677), so there is nothing to redeem.
//
// REDEEM IS A GLOBAL ACTION BY NECESSITY, which is the argument for both this
// route and its button, and survives the park: it is the door for someone
// who was GIVEN Credits and holds nothing, so a Redeem tucked inside a
// balance card would be unreachable by exactly the guest who needs it.
//
// IT IS INSIDE THE AUTH WALL. Claiming credits a wallet, and a wallet needs an
// account. The public half — a link that lands a stranger with no account — is
// a separate top-level route that does not exist yet (MESITA-1677); it funnels
// here after sign-in rather than duplicating this screen.

export default function RedeemCreditsPage() {
  return <RedeemClient />;
}
