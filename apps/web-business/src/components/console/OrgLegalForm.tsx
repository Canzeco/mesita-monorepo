"use client";

import { useActionState } from "react";
import { Field } from "@/components/shared/Field";
import {
  updateOrganizationAction,
  type UpdateOrgState,
} from "@/app/(shell)/actions/organizations";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

const INITIAL: UpdateOrgState = { error: null, saved: false };

/** The legal identity lives here, not on creation: an organization with
 *  neither field can hold places — both become required the day it
 *  partners a place or gets paid. */
export function OrgLegalForm({
  orgId,
  legalName,
  rfc,
}: {
  orgId: string;
  legalName: string | null;
  rfc: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateOrganizationAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="orgId" value={orgId} />
      <Field label="Legal name">
        <input
          name="legalName"
          defaultValue={legalName ?? ""}
          maxLength={200}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="RFC">
        <input
          name="rfc"
          defaultValue={rfc ?? ""}
          maxLength={20}
          className={INPUT_CLASS}
        />
      </Field>
      {state.error && <p className={ERROR_BOX_CLASS}>{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={PRIMARY_BUTTON_CLASS}
        >
          {pending ? "Saving..." : "Save legal details"}
        </button>
        {state.saved && !pending && (
          <span className="text-muted-foreground text-[12px]">Saved.</span>
        )}
      </div>
    </form>
  );
}
