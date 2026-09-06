"use client";

import { useActionState } from "react";
import { StatePill, DataRow } from "@/components/console/badges";
import {
  connectPaymentsAction,
  openPaymentsDashboardAction,
  type PaymentsActionState,
} from "@/app/(shell)/actions/organizations";
import {
  paymentAccountState,
  type PaymentAccount,
} from "@/lib/api/organizations";
import {
  CTA_BUTTON_CLASS,
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PILL_BUTTON_CLASS,
} from "@/lib/ui-classes";

const INITIAL: PaymentsActionState = { error: null, note: null };

/** Mirror of the EF allowlist (stripe-connect.ts MESITA_CONNECT_COUNTRIES).
 *  Country is permanent on the Stripe account, so it is asked exactly once —
 *  here, at connect time — and never again. */
const CONNECT_COUNTRIES = [
  { code: "MX", label: "Mexico" },
  { code: "US", label: "United States" },
] as const;

export function PaymentsCard({
  orgId,
  account,
  orphaned,
  isOwner,
  hasLegalName = true,
}: {
  orgId: string;
  account: PaymentAccount | null;
  orphaned: boolean;
  isOwner: boolean;
  /** Cashes the identity-fold promise: when false and no account exists, a
   *  muted nudge under the connect form points at the legal-identity group.
   *  Never blocks connecting. */
  hasLegalName?: boolean;
}) {
  const [connectState, connectAction, connecting] = useActionState(
    connectPaymentsAction,
    INITIAL,
  );
  const [dashState, dashAction, opening] = useActionState(
    openPaymentsDashboardAction,
    INITIAL,
  );

  const state = paymentAccountState(account, orphaned);
  const error = connectState.error ?? dashState.error;
  const note = connectState.note ?? dashState.note;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DataRow label="Account">
          <StatePill state={state} />
        </DataRow>
        {account?.country && (
          <DataRow label="Country">{account.country}</DataRow>
        )}
        {account && (
          <DataRow label="Payouts">
            {account.payouts_enabled ? "Enabled" : "Not yet"}
          </DataRow>
        )}
        {state === "restricted" && (
          <DataRow label="Why">
            {orphaned
              ? "The Stripe account no longer exists — connect again."
              : (account?.disabled_reason ?? "Stripe restricted the account.")}
          </DataRow>
        )}
        {state === "pending" && account !== null &&
          account.requirements_due.length > 0 && (
          <DataRow label="Stripe still needs">
            {`${account.requirements_due.length} item${
              account.requirements_due.length === 1 ? "" : "s"
            }`}
          </DataRow>
        )}
      </div>

      {isOwner && (
        <div className="flex flex-col gap-3">
          {state === "none" || orphaned ? (
            <form action={connectAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="orgId" value={orgId} />
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-muted-foreground text-[12px]">
                  Country — permanent on the Stripe account
                </span>
                <select name="country" defaultValue="MX" className={INPUT_CLASS}>
                  {CONNECT_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={connecting}
                className={CTA_BUTTON_CLASS}
              >
                {connecting ? "Opening Stripe..." : "Connect payments"}
              </button>
              {!hasLegalName && (
                <p className="text-muted-foreground w-full text-[12px]">
                  Add your legal name below and Stripe onboarding comes
                  prefilled.
                </p>
              )}
            </form>
          ) : (
            <div className="flex items-center gap-3">
              {!account?.details_submitted && (
                <form action={connectAction}>
                  <input type="hidden" name="orgId" value={orgId} />
                  <input
                    type="hidden"
                    name="country"
                    value={account?.country ?? "MX"}
                  />
                  <button
                    type="submit"
                    disabled={connecting}
                    className={CTA_BUTTON_CLASS}
                  >
                    {connecting ? "Opening Stripe..." : "Resume onboarding"}
                  </button>
                </form>
              )}
              <form action={dashAction}>
                <input type="hidden" name="orgId" value={orgId} />
                <button
                  type="submit"
                  disabled={opening}
                  className={PILL_BUTTON_CLASS}
                >
                  {opening ? "Opening..." : "Open Stripe dashboard"}
                </button>
              </form>
            </div>
          )}
          {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
          {note && !error && (
            <p className="text-muted-foreground text-[12px]">{note}</p>
          )}
        </div>
      )}
    </div>
  );
}
