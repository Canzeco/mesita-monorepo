"use client";

import { useActionState } from "react";
import { Field } from "@/components/shared/Field";
import {
  createOrganizationAction,
  type CreateOrgState,
} from "@/app/(shell)/actions/organizations";
import {
  ERROR_BOX_CLASS,
  FORM_COLUMN_CLASS,
  INPUT_CLASS,
  PILL_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const INITIAL: CreateOrgState = { error: null };

/** Name only, on purpose: legal name and RFC are not creation facts — an
 *  organization with neither can hold places. They live on the Organization
 *  screen's Identity card and become required before it can be paid.
 *
 *  Two weights, because the same form does two jobs. On the first-run
 *  screen it IS the page, so it gets the full-width slab. Under an existing
 *  organization it is the rarest action on the screen, so it gets a pill —
 *  a second black slab there just outshouts everything the page is for. */
export function CreateOrganizationForm({
  variant = "page",
}: {
  variant?: "page" | "inline";
}) {
  const [state, formAction, pending] = useActionState(
    createOrganizationAction,
    INITIAL,
  );
  const inline = variant === "inline";

  return (
    <form action={formAction} className={FORM_COLUMN_CLASS}>
      <Field label="Name" required>
        <input
          name="name"
          required
          maxLength={120}
          autoFocus={inline}
          className={INPUT_CLASS}
        />
      </Field>
      {state.error && <p className={ERROR_BOX_CLASS}>{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={
          inline
            ? cn(PILL_BUTTON_CLASS, "self-start")
            : PRIMARY_BUTTON_CLASS
        }
      >
        {pending ? "Creating..." : "Create organization"}
      </button>
    </form>
  );
}
