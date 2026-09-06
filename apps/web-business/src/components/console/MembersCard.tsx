"use client";

// Members — who is in the organization, read first. Rows are people, not
// facts, so this is deliberately NOT DataRow (which would mute the name and
// bold the role — backwards emphasis): name leads in font-medium, email
// beneath in muted 12px, and when the name is null — every production row
// today — the email PROMOTES to the primary line.
//
// The owner's "Add member" is a disclosure (collapsed by default, label
// names the action). Minimal slice: adds an EXISTING business account by
// email; unknown addresses get the sign-in-first line — email invites are a
// filed follow-up. Roles addable here: editor/viewer only (owner grants are
// a distinct ceremony that lands with remove + the ≥1-owner backstop).

import { useActionState, useState } from "react";
import { Section } from "@/components/shared/Section";
import { Field } from "@/components/shared/Field";
import {
  addOrgMemberAction,
  type AddMemberState,
} from "@/app/(shell)/actions/organizations";
import type { OrgMember } from "@/lib/api/organizations";
import {
  ERROR_BOX_CLASS,
  FORM_COLUMN_CLASS,
  GHOST_PILL_BUTTON_CLASS,
  INPUT_CLASS,
  PILL_BUTTON_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const INITIAL: AddMemberState = { error: null, email: "", added: false };

function RoleChip({ role }: { role: string }) {
  return (
    <span className="border-border bg-card rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize">
      {role}
    </span>
  );
}

export function MembersCard({
  orgId,
  members,
  myManagerId,
  isOwner,
  loadError,
}: {
  orgId: string;
  members: OrgMember[];
  myManagerId: string;
  isOwner: boolean;
  loadError: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addOrgMemberAction, INITIAL);

  // A successful add is the end of the disclosure. Adjusted during render,
  // keyed on the state OBJECT (the `added` boolean stays true across a
  // second add) — the OrgIdentityCard grammar, on purpose.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.added) setOpen(false);
  }

  return (
    <Section
      title="Members"
      description="Org roles govern this screen; place teams are separate."
      right={
        isOwner && !loadError ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={GHOST_PILL_BUTTON_CLASS}
          >
            {open ? "Cancel" : "Add member"}
          </button>
        ) : undefined
      }
    >
      {loadError ? (
        // Never an empty list: zero members is impossible (the creator is
        // owner), so an empty render would be a lie. Say what happened.
        <p className="text-muted-foreground text-sm">{loadError}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="divide-border divide-y">
            {members.map((m) => {
              const primary = m.name ?? m.email ?? "—";
              const secondary = m.name ? m.email : null;
              return (
                <li
                  key={m.managerId}
                  className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{primary}</p>
                    {secondary && (
                      <p className="text-muted-foreground truncate text-[12px]">
                        {secondary}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {m.managerId === myManagerId && (
                      <span className="text-muted-foreground text-[11px]">
                        You
                      </span>
                    )}
                    <RoleChip role={m.role} />
                  </div>
                </li>
              );
            })}
          </ul>

          {state.added && !open && (
            <p className="text-muted-foreground text-[12px]">Added.</p>
          )}

          {isOwner && open && (
            <form action={formAction} className={FORM_COLUMN_CLASS}>
              <input type="hidden" name="orgId" value={orgId} />
              <Field label="Email" required>
                <input
                  name="email"
                  type="email"
                  required
                  // An error never eats the typed address — the action echoes
                  // it back, and the one path Pato will hit this week (404,
                  // sign-in-first) would otherwise mean retyping it.
                  defaultValue={state.email}
                  key={state === INITIAL ? "fresh" : "echo"}
                  autoFocus
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Role">
                <select
                  name="role"
                  defaultValue="editor"
                  className={cn(INPUT_CLASS, "max-w-[12rem]")}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </Field>
              {state.error && <p className={ERROR_BOX_CLASS}>{state.error}</p>}
              <button
                type="submit"
                disabled={pending}
                className={cn(PILL_BUTTON_CLASS, "self-start")}
              >
                {pending ? "Adding..." : "Add member"}
              </button>
            </form>
          )}
        </div>
      )}
    </Section>
  );
}
