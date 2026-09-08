import { RedeemClient } from "./RedeemClient";
import { PIN_LENGTH } from "@/components/consumer/PinField";

// /new-visit/wallet/redeem — claim gifted Credits with a ten-digit code.
//
// REDEEM IS A GLOBAL ACTION BY NECESSITY, which is the argument for both this
// route and its button. It is the door for someone who was GIVEN Credits and
// holds nothing, so a Redeem tucked inside a balance card would be unreachable
// by exactly the guest who needs it.
//
// IT IS INSIDE THE AUTH WALL. Claiming credits a wallet, and a wallet needs an
// account. The PUBLIC half — a link that lands a stranger with no account — is
// /gift/[code] (MESITA-1677), a top-level route outside (shell); it funnels
// here after sign-in with the SAME ?code= this page already reads, rather than
// duplicating this screen.
//
// ?code= IS READ SERVER-SIDE and prefilled, so the landing route only has to
// forward one query param. Digits only, capped at the field's length:
// whatever arrives in the URL is a stranger's string, and the field's own
// rules are the only ones that decide what a code can be.
//
// REAL AS OF MESITA-1677: RedeemClient calls consumer-web-redeem-credit-gift
// instead of the browser emulator, so there is no demo seed to read
// server-side any more — same simplification buy/page.tsx and gift/page.tsx
// already made.

export default async function RedeemCreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.code) ? sp.code[0] : sp.code;
  const code = (raw ?? "").replace(/\D/g, "").slice(0, PIN_LENGTH);
  return <RedeemClient initialCode={code} />;
}
