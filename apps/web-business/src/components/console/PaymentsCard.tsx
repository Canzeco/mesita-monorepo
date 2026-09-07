"use client";

import { CONNECT_COUNTRIES } from "@/lib/connect-countries";
import { CONNECT_ENTITY_TYPES } from "@/lib/connect-entity-types";
import { useActionState } from "react";
import {
  StatePill,
  DataRow,
  READY_CAPTION,
  disabledReasonCopy,
} from "@/components/console/badges";
import {
  connectPaymentsAction,
  openPaymentsDashboardAction,
  type PaymentsActionState,
} from "@/app/(shell)/actions/organizations";
import {
  paymentAccountState,
  type PaymentAccount,
} from "@/lib/api/organizations";
import { cn } from "@/lib/utils";
import {
  CTA_BUTTON_CLASS,
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PILL_BUTTON_CLASS,
} from "@/lib/ui-classes";

const INITIAL: PaymentsActionState = { error: null, note: null };

/**
 * One failure, said once, where the eye already is.
 *
 * The card used to coalesce both actions' errors into a single 12px line
 * BELOW both forms (MESITA-1645). Three problems in one slot: a
 * failed Connect and a failed dashboard-open were indistinguishable, the page
 * did not move on submit so the honest read was "the button did nothing", and
 * it sat under the control that failed. Now each form owns its own, above its
 * own button, with a title and a live region so a screen reader announces it.
 */
function ErrorBox({ title, message }: { title: string; message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(ERROR_BOX_CLASS, "w-full text-sm leading-relaxed")}
    >
      <span className="block font-semibold">{title}</span>
      <span className="block">{message}</span>
    </div>
  );
}


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
  /** Cashes the identity-fold promise: when false and no account exists, the
   *  muted line under the connect form adds a nudge toward the legal-identity
   *  group. Never blocks connecting — the only gate is country + entity. */
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
  const note = connectState.note ?? dashState.note;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DataRow label="Account">
          <StatePill state={state} />
        </DataRow>
        {/* The pill says "Ready", and this says what Ready costs the owner in
            waiting. Without it "Ready" is just a quieter version of the same
            unanswered question (MESITA-1643). */}
        {state === "live" && READY_CAPTION && (
          <p className="text-muted-foreground mt-1 mb-2 text-[12px] leading-relaxed">
            {READY_CAPTION}
          </p>
        )}
        {state === "in_review" && (
          <p className="text-muted-foreground mt-1 mb-2 text-[12px] leading-relaxed">
            Stripe has everything it asked for and is checking it. Nothing to do
            right now — we&apos;ll email you when it&apos;s done.
          </p>
        )}
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
              : disabledReasonCopy(account?.disabled_reason)}
          </DataRow>
        )}
        {state === "unfinished" && account !== null &&
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
              <ErrorBox
                title="Couldn't connect payments"
                message={connectState.error}
              />
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="intent" value="create" />
              <label className="flex flex-1 basis-40 flex-col gap-1.5">
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
              {/* The second half of the pre-onboarding gate. No valid default:
                  this answer decides which documents Stripe asks for next, and
                  a silent "individual" sends a persona moral down the wrong
                  branch — which costs a restart, not a correction. */}
              <label className="flex flex-1 basis-40 flex-col gap-1.5">
                <span className="text-muted-foreground text-[12px]">
                  Legal entity — decides what Stripe asks for
                </span>
                <select
                  name="entityType"
                  defaultValue=""
                  required
                  className={INPUT_CLASS}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {CONNECT_ENTITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
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
              <p className="text-muted-foreground w-full text-[12px]">
                Stripe asks for the rest — RFC, address, bank account — in its
                own onboarding.
                {!hasLegalName &&
                  " Add your legal name below and it comes prefilled."}
              </p>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              <ErrorBox title="Couldn't connect payments" message={connectState.error} />
              <div className="flex items-center gap-3">
              {/* Resume follows the STATE. It used to key off
                  !details_submitted, which meant an account waiting on Stripe
                  still offered a button that reopened a finished form
                  (MESITA-1645). */}
              {state === "unfinished" && (
                <form action={connectAction}>
                  <input type="hidden" name="orgId" value={orgId} />
                  {/* Resume mints a link for an account that already exists,
                      so the entity gate does not apply — the account was
                      created with its answer, and Stripe owns it from here. */}
                  <input type="hidden" name="intent" value="resume" />
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
              <ErrorBox title="Couldn't open the Stripe dashboard" message={dashState.error} />
            </div>
          )}
          {note && !connectState.error && !dashState.error && (
            <p className="text-muted-foreground text-[12px]">{note}</p>
          )}
        </div>
      )}
    </div>
  );
}
