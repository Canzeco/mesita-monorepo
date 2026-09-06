"use client";

import { useActionState } from "react";
import { Field } from "@/components/shared/Field";
import {
  createOrganizationAction,
  type CreateOrgState,
} from "@/app/(shell)/actions/organizations";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

const INITIAL: CreateOrgState = { error: null };

/** Name only, on purpose: legal name and RFC are not creation facts — an
 *  organization with neither can hold places. They live on the Organization
 *  screen's Identity card and become required before it can be paid. */
export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState(
    createOrganizationAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label="Name" required>
        <input name="name" required maxLength={120} className={INPUT_CLASS} />
      </Field>
      {state.error && <p className={ERROR_BOX_CLASS}>{state.error}</p>}
      <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
        {pending ? "Creating..." : "Create organization"}
      </button>
    </form>
  );
}
