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

/** RFC and legal name are optional here on purpose: ownership
 *  verification is out of scope, and an organization with neither can
 *  still hold places. They become required before it can be paid. */
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
      <Field label="Legal name">
        <input name="legalName" className={INPUT_CLASS} />
      </Field>
      <Field label="RFC">
        <input name="rfc" className={INPUT_CLASS} />
      </Field>
      {state.error && <p className={ERROR_BOX_CLASS}>{state.error}</p>}
      <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
        {pending ? "Creating..." : "Create organization"}
      </button>
    </form>
  );
}
