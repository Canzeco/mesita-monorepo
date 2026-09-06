"use client";

// Legal identity — read first, edit on request. Lives INSIDE the Stripe
// Account box now (the five-box recomposition): legal name and RFC are
// merchant identity, so they sit with the account they prefill. The group
// keeps the toggle grammar this file established — read rows, a ghost
// button, form on request, closed by a successful save.
//
// One caption, never two: before an account exists it says what the fields
// are FOR (prefill + facturación); once an account exists Stripe's verified
// KYC record is the master and the caption says exactly that instead.
//
// "Your role" left this group for the Members box (a people fact, shown
// there as the "You" tag).

import { useActionState, useState } from "react";
import { Field } from "@/components/shared/Field";
import { DataRow } from "@/components/console/badges";
import {
  updateOrganizationAction,
  type UpdateOrgState,
} from "@/app/(shell)/actions/organizations";
import {
  ERROR_BOX_CLASS,
  FORM_COLUMN_CLASS,
  GHOST_PILL_BUTTON_CLASS,
  INPUT_CLASS,
  PILL_BUTTON_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const INITIAL: UpdateOrgState = { error: null, saved: false };

const NOT_SET = <span className="text-muted-foreground font-normal">Not set</span>;

export function OrgIdentityCard({
  orgId,
  legalName,
  rfc,
  currency,
  isOwner,
  hasAccount,
}: {
  orgId: string;
  legalName: string | null;
  rfc: string | null;
  currency: string;
  isOwner: boolean;
  hasAccount: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateOrganizationAction,
    INITIAL,
  );

  // A successful save is the end of editing. Adjusted during render rather
  // than in an effect (no cascading render), and keyed on the state OBJECT,
  // not on `saved` — `saved` stays true across a second save, so comparing
  // the boolean would close the form once and never again.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.saved) setEditing(false);
  }

  return (
    <div className="border-border border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className={TINY_LABEL_CLASS}>Legal identity</p>
        {isOwner && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={GHOST_PILL_BUTTON_CLASS}
          >
            {editing ? "Cancel" : legalName || rfc ? "Edit" : "Add details"}
          </button>
        )}
      </div>

      {editing ? (
        <form action={formAction} className={cn(FORM_COLUMN_CLASS, "mt-3")}>
          <input type="hidden" name="orgId" value={orgId} />
          <Field label="Legal name">
            <input
              name="legalName"
              defaultValue={legalName ?? ""}
              maxLength={200}
              placeholder="Grupo Mesita S.A. de C.V."
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="RFC">
            <input
              name="rfc"
              defaultValue={rfc ?? ""}
              maxLength={20}
              placeholder="XAXX010101000"
              autoCapitalize="characters"
              // 12 characters for a company, 13 for a person: a field sized
              // to its content is the cheapest format hint there is.
              className={cn(INPUT_CLASS, "max-w-[15rem] font-mono uppercase")}
            />
          </Field>
          {state.error && <p className={ERROR_BOX_CLASS}>{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className={cn(PILL_BUTTON_CLASS, "self-start")}
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </form>
      ) : (
        <div className="mt-1">
          <DataRow label="Legal name">{legalName ?? NOT_SET}</DataRow>
          <DataRow label="RFC">
            {rfc ? <span className="font-mono">{rfc}</span> : NOT_SET}
          </DataRow>
          <DataRow label="Currency">{currency}</DataRow>
        </div>
      )}

      <p className="text-muted-foreground mt-2 text-[12px]">
        {hasAccount
          ? "Stripe's verified record is the master for legal identity; these fields prefill and serve facturación."
          : "Prefills Stripe onboarding; saved for facturación."}
      </p>
    </div>
  );
}
