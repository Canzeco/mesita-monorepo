"use client";

import { CONNECT_COUNTRIES } from "@/lib/connect-countries";
import { CONNECT_ENTITY_TYPES } from "@/lib/connect-entity-types";
import { useActionState, useState } from "react";
import {
  StatePill,
  DataRow,
  READY_CAPTION,
  disabledReasonCopy,
} from "@/components/console/badges";
import { Field, Modal } from "@/components/shared";
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
  PRIMARY_BUTTON_CLASS,
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


/**
 * The two permanent answers, asked once, inside the modal the button opens.
 *
 * They used to sit on the card itself — two selects, their captions, and a
 * caveat paragraph wrapped around the CTA they gate. On a summary box whose
 * other rows are one label and one value, that reads as clutter, not as a
 * question (Pato, 2026-09-09). The gate is unchanged: country and legal
 * entity, both before onboarding opens, the entity with no valid default.
 *
 * Exported so the gate can be asserted directly — the card renders a button,
 * and a closed modal has no DOM.
 */
export function ConnectStripeForm({
  orgId,
  action,
  pending,
  error,
}: {
  orgId: string;
  action: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorBox title="Couldn't connect payments" message={error} />
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="intent" value="create" />
      <Field label="Country">
        <select name="country" defaultValue="MX" className={INPUT_CLASS}>
          {CONNECT_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground mt-1.5 block text-[12px]">
          Permanent on the Stripe account.
        </span>
      </Field>
      {/* The second half of the pre-onboarding gate. No valid default:
          this answer decides which documents Stripe asks for next, and
          a silent "individual" sends a persona moral down the wrong
          branch — which costs a restart, not a correction. */}
      <Field label="Legal entity" required>
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
        <span className="text-muted-foreground mt-1.5 block text-[12px]">
          Decides what Stripe asks for.
        </span>
      </Field>
      <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
        {pending ? "Opening Stripe..." : "Continue to Stripe"}
      </button>
      <p className="text-muted-foreground text-[12px] leading-relaxed">
        Stripe asks for the rest — legal name, RFC, address, bank account — in
        its own onboarding.
      </p>
    </form>
  );
}

export function PaymentsCard({
  orgId,
  account,
  orphaned,
  isOwner,
}: {
  orgId: string;
  account: PaymentAccount | null;
  orphaned: boolean;
  isOwner: boolean;
}) {
  const [connectState, connectAction, connecting] = useActionState(
    connectPaymentsAction,
    INITIAL,
  );
  const [dashState, dashAction, opening] = useActionState(
    openPaymentsDashboardAction,
    INITIAL,
  );
  const [connectOpen, setConnectOpen] = useState(false);

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
            <>
              {/* The button and nothing else. The rows above already say the
                  state — "No account", and for an orphan the Why row says the
                  account is gone — so a sentence here would only repeat them
                  in a second voice. */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setConnectOpen(true)}
                  className={CTA_BUTTON_CLASS}
                >
                  {orphaned ? "Connect again" : "Connect Stripe"}
                </button>
              </div>
              {/* A failure keeps the modal up: the answers are still in the
                  fields, and the message belongs beside them, not on a card
                  the reader has already been sent back to. */}
              {connectOpen && (
                <Modal
                  title="Connect Stripe"
                  description="Two answers Stripe can't change later."
                  onClose={() => setConnectOpen(false)}
                >
                  <ConnectStripeForm
                    orgId={orgId}
                    action={connectAction}
                    pending={connecting}
                    error={connectState.error}
                  />
                </Modal>
              )}
            </>
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
