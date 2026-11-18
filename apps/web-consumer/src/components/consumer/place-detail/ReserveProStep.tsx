"use client";

// The reserve flow's hidden fourth step (MESITA-4393, Pato: "if reservations
// missing, actually offer the subscription in a fourth hidden subpage"). Not
// in the step bar (it still reads 3 of 3); the form shows it in place of the
// step's body when the guest has none left and Pro would unblock them.
//
//   You've used your 3 reservations this month.
//   More on Dec 1.
//   [ Mesita Pro card · Upgrade to Pro · Billed monthly in USD · Cancel anytime ]
//   Not now
//
// While a payment is still processing, Upgrade is hidden and Try again is
// the only action, so a second Checkout is never offered. Errors use the
// form's footer error line. Removing guest Pro later: this file, ProOffer,
// plan-perks and the form's one conditional render.

import { ProOffer, UpgradeAction } from "@/components/consumer/me/ProOffer";
import type { GuestPlanView } from "@/lib/api/plan";
import { resetDay } from "@/lib/reset-day";

export function ReserveProStep({
  view,
  busy,
  pending,
  checkFailed,
  onUpgrade,
  onRetry,
  onNotNow,
}: {
  view: GuestPlanView | null;
  busy: boolean;
  /** Stripe has not settled the payment yet. */
  pending: boolean;
  /** The payment could not be read back. */
  checkFailed: boolean;
  onUpgrade: () => void;
  onRetry: () => void;
  onNotNow: () => void;
}) {
  const checking = pending || checkFailed;
  return (
    <div className="flex flex-col gap-4" data-reserve-pro-step="">
      <div>
        <p className="type-body text-foreground font-semibold">
          {view
            ? `You've used your ${view.cap} reservations this month.`
            : "You've used this month's reservations."}
        </p>
        <p className="text-muted-foreground type-body mt-0.5">
          More on {resetDay()}.
        </p>
      </div>
      <ProOffer current={false}>
        {checking ? (
          <p className="text-muted-foreground type-body" aria-live="polite">
            {pending
              ? "Your payment is still processing. Check back in a minute."
              : "We couldn't check your payment yet."}{" "}
            <button
              type="button"
              onClick={onRetry}
              className="text-foreground -my-3 inline-flex min-h-11 items-center font-semibold underline"
            >
              Try again
            </button>
          </p>
        ) : (
          <UpgradeAction onUpgrade={onUpgrade} busy={busy} />
        )}
      </ProOffer>
      {!checking && (
        <button
          type="button"
          onClick={onNotNow}
          className="text-muted-foreground type-body mx-auto inline-flex min-h-11 items-center font-medium underline-offset-2 hover:underline"
        >
          Not now
        </button>
      )}
    </div>
  );
}
