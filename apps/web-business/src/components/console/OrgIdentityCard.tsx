"use client";

// Identity — read first, edit on request.
//
// The legal name and the RFC are typed once, ever, and only matter the day
// this organization partners a place or gets paid. Mounting their inputs
// permanently made a read-mostly screen look like a form: two empty boxes
// the width of the page and a black slab under them, for four facts that
// fit in four rows. So the card shows the four rows, and the owner opens
// the form when there is something to change.
//
// Non-owners never see the toggle: the same four rows, no affordance.

import { useActionState, useState } from "react";
import { Field } from "@/components/shared/Field";
import { Section } from "@/components/shared/Section";
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
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const INITIAL: UpdateOrgState = { error: null, saved: false };

const NOT_SET = <span className="text-muted-foreground font-normal">Not set</span>;

export function OrgIdentityCard({
  orgId,
  legalName,
  rfc,
  currency,
  myRole,
}: {
  orgId: string;
  legalName: string | null;
  rfc: string | null;
  currency: string;
  myRole: string;
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

  const isOwner = myRole === "owner";

  return (
    <Section
      title="Identity"
      description="One legal person, one RFC — needed only to partner places and get paid."
      right={
        isOwner ? (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={GHOST_PILL_BUTTON_CLASS}
          >
            {editing ? "Cancel" : legalName || rfc ? "Edit" : "Add details"}
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <form action={formAction} className={FORM_COLUMN_CLASS}>
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
        <div>
          <DataRow label="Legal name">{legalName ?? NOT_SET}</DataRow>
          <DataRow label="RFC">
            {rfc ? <span className="font-mono">{rfc}</span> : NOT_SET}
          </DataRow>
          <DataRow label="Currency">{currency}</DataRow>
          <DataRow label="Your role">
            <span className="capitalize">{myRole}</span>
          </DataRow>
        </div>
      )}
    </Section>
  );
}
