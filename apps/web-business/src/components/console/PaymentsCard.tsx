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

/**
 * `account: null` means TWO different things, and for months the card could
 * only say one of them (MESITA-1861).
 *
 * The page catches a failed `business-web-get-payment-account` and leaves
 * `account` null; `paymentAccountState(null, false)` returns `"none"`; the
 * pill says **No account** and the card offers **Connect Stripe**. So a
 * transient Edge Function blip told an owner with a live, charging Stripe
 * account that they had none, and put a button in front of them that creates
 * a SECOND one. The page's own docblock forbade exactly this — "A failure is
 * no box state, never a box that asserts 'not connected' about an account
 * nobody managed to ask about" — and the code did it anyway, because null
 * carried no way to tell the two apart.
 *
 * `loadError` is that way. It is a separate branch, not a third state on the
 * pill: an unread account has no state to show, so the card shows none and
 * offers no action. Same shape and same words as MembersCard's `loadError`,
 * because they are the same failure on the same page.
 */
export function PaymentsCard({
  orgId,
  account,
  orphaned,
  isOwner,
  loadError,
}: {
  orgId: string;
  account: PaymentAccount | null;
  orphaned: boolean;
  isOwner: boolean;
  loadError: string | null;
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

  // Never "No account" on a failed read, and never a Connect button under it.
  if (loadError) {
    return <p className="text-muted-foreground text-sm">{loadError}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {/* The Section above is titled "Stripe". A row labelled "Account"
            under it was the card's ONLY row restating its own heading
            (MESITA-1847) — so the label was emptied and the row kept. On a
            fluid full-width card that left a bordered row with an empty left
            cell, a hairline under it, and the pill alone at the far right:
            ~1400px of underlined nothing, the ugliest element on the page.
            Emptying a row does not remove it. The row is gone; the pill and
            the action it gates now sit together, first thing in the lane
            (MESITA-1861). */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatePill state={state} />
          {isOwner && (state === "none" || orphaned) && (
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className={CTA_BUTTON_CLASS}
            >
              {orphaned ? "Connect again" : "Connect Stripe"}
            </button>
          )}
        </div>
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

      {/* The not-connected branch has NO block here any more — its button is
          up beside the state pill and its modal is a sibling below, so this
          renders only when there is genuinely something to render. An empty
          `<div className="flex flex-col gap-3">` is still a flex item, and
          the parent's `gap-4` pays for it: 16px of dead space at the foot of
          the card, which is the same bug this issue is removing (MESITA-1861). */}
      {isOwner && state !== "none" && !orphaned && (
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
          {note && !connectState.error && !dashState.error && (
            <p className="text-muted-foreground text-[12px]">{note}</p>
          )}
        </div>
      )}

      {/* The connect path's own feedback, on the card rather than in the
          wrapper that no longer exists: a failure the modal has already been
          dismissed past still has to be said somewhere. */}
      {isOwner && (state === "none" || orphaned) && (
        <>
          {note && !connectState.error && (
            <p className="text-muted-foreground text-[12px]">{note}</p>
          )}
          {/* A failure keeps the modal up: the answers are still in the
              fields, and the message belongs beside them, not on a card the
              reader has already been sent back to. */}
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
      )}
    </div>
  );
}
